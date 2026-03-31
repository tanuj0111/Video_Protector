const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");
const auth = require("../middleware/auth");

const router = express.Router();

// ─── Paths ────────────────────────────────────────────────────────────────────
const VIDEOS_DIR = path.join(__dirname, "../videos");
const META_FILE = path.join(__dirname, "../videos/meta.json");
const UPLOADS_TMP = path.join(__dirname, "../uploads_tmp");

[VIDEOS_DIR, UPLOADS_TMP].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Metadata helpers ─────────────────────────────────────────────────────────
function readMeta() {
  if (!fs.existsSync(META_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeMeta(data) {
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2));
}

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_TMP,
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase()))
      cb(null, true);
    else cb(new Error("Only video files allowed"));
  },
});

// ─── AES-128 key generate & keyinfo file banana ───────────────────────────────
function generateEncryptionKey(
  outputDir,
  videoId,
  serverUrl = "http://localhost:5001",
) {
  // 16 byte random AES key
  const key = crypto.randomBytes(16);
  const keyHex = key.toString("hex");
  const iv = crypto.randomBytes(16).toString("hex");

  const keyFile = path.join(outputDir, "enc.key");
  const keyInfoFile = path.join(outputDir, "enc.keyinfo");

  // Key file (binary)
  fs.writeFileSync(keyFile, key);

  // keyinfo format:
  // Line 1: URL where player will fetch the key (via our secure API)
  // Line 2: local path to key file (ffmpeg ke liye)
  // Line 3: IV (optional, ffmpeg auto-generate bhi kar sakta hai)
  const keyUrl = `${serverUrl}/api/video/${videoId}/enc.key`;
  fs.writeFileSync(keyInfoFile, `${keyUrl}\n${keyFile}\n${iv}`);

  return keyInfoFile;
}

// ─── GET /api/admin/videos ────────────────────────────────────────────────────
router.get("/videos", auth, (req, res) => {
  res.json(readMeta());
});

// ─── POST /api/admin/upload ───────────────────────────────────────────────────
router.post("/upload", auth, upload.single("video"), (req, res) => {
  const meta = readMeta();

  if (meta.length >= 5) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res
      .status(400)
      .json({ message: "Maximum 5 videos allowed. Delete one first." });
  }

  const { title } = req.body;
  if (!title || !title.trim()) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: "Title is required" });
  }
  if (!req.file)
    return res.status(400).json({ message: "Video file is required" });

  const videoId = "video_" + Date.now();
  const outputDir = path.join(VIDEOS_DIR, videoId);
  fs.mkdirSync(outputDir, { recursive: true });

 try {
  // serverUrl fix: https hardcoded - v2
    const serverUrl = "https://videoprotector-production.up.railway.app";
    const keyInfoFile = generateEncryptionKey(outputDir, videoId, serverUrl);
    // FFmpeg — HLS + AES-128 encryption
   execSync(
  `ffmpeg -i "${req.file.path}" \
    -vf "scale=1280:720" \
    -profile:v baseline -level 3.0 \
    -b:v 1500k \
    -b:a 128k \
    -start_number 0 \
    -hls_time 10 \
    -hls_list_size 0 \
    -hls_key_info_file "${keyInfoFile}" \
    -f hls \
    "${path.join(outputDir, "playlist.m3u8")}"`,
  { stdio: "pipe" },
);

    fs.unlinkSync(req.file.path);

    const newVideo = {
      id: videoId,
      title: title.trim(),
      uploadedAt: new Date().toISOString(),
      playlistUrl: `/api/video/${videoId}/playlist.m3u8`,
    };

    meta.push(newVideo);
    writeMeta(meta);

    res.json({
      message: "Video uploaded, converted & AES-128 encrypted!",
      video: newVideo,
    });
  } catch (err) {
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
    try {
      fs.rmSync(outputDir, { recursive: true });
    } catch {}
    console.error("FFmpeg error:", err.message);
    res
      .status(500)
      .json({
        message: "Conversion failed. Is ffmpeg installed?",
        error: err.message,
      });
  }
});

// ─── DELETE /api/admin/videos/:id ────────────────────────────────────────────
router.delete("/videos/:id", auth, (req, res) => {
  const videoId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");
  let meta = readMeta();
  const idx = meta.findIndex((v) => v.id === videoId);
  if (idx === -1) return res.status(404).json({ message: "Video not found" });

  try {
    fs.rmSync(path.join(VIDEOS_DIR, videoId), { recursive: true });
  } catch {}
  meta.splice(idx, 1);
  writeMeta(meta);

  res.json({ message: "Video deleted" });
});

module.exports = router;
