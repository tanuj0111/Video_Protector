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
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5001";


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

// ─── Multer: Video + PDF ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_TMP,
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    const allowed = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only video files allowed"));
    }
  } else if (file.fieldname === "pdf") {
    if (path.extname(file.originalname).toLowerCase() === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files allowed"));
    }
  } else {
    cb(new Error("Invalid field"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter,
});

const pdfUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files allowed"));
    }
  },
});

// ─── AES-128 key generate & keyinfo file banana ───────────────────────────────
function generateEncryptionKey(
  outputDir,
  videoId,
  serverUrl = "https://videoprotector-production.up.railway.app",
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

router.get("/debug-path", (req, res) => {
  res.json({
    dirname: __dirname,
    cwd: process.cwd(),
    metaFile: META_FILE,
    env: process.env.NODE_ENV
  });
});

// ─── POST /api/admin/upload ───────────────────────────────────────────────────
router.post("/upload", auth, upload.single("video"), (req, res) => {
  const meta = readMeta();
  const folderHeader = req.body.folder || "General";

  // Permanent log file to verify what the backend hears
  // fs.writeFileSync(path.join(__dirname, "../../DEBUG_FOLDER_IN.txt"), `Folder received: ${folderHeader}\nTime: ${new Date().toISOString()}`);

  const { title, folder } = req.body;
  // console.log("FOLDER RECEIVED:", req.body.folder);
  // console.log("FULL BODY:", req.body);
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
    // serverUrl fix: https hardcoded - v2 (now use env/default localhost)
    const keyInfoFile = generateEncryptionKey(outputDir, videoId, SERVER_URL);

    // FFmpeg — HLS + AES-128 encryption
    const videoFile = req.file;
    execSync(
      `ffmpeg -i "${videoFile.path}" \
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

    fs.unlinkSync(videoFile.path);

    const newVideo = {
      id: videoId,
      title: title.trim(),
      folder: req.body.folder || "General",
      uploadedAt: new Date().toISOString(),
      playlistUrl: `/api/video/${videoId}/playlist.m3u8`,
      pdfUrl: null,
    };

    meta.push(newVideo);
    writeMeta(meta);

    res.json({
      message: "Video uploaded, converted & AES-128 encrypted!",
      video: newVideo,
    });
  } catch (err) {
    try {
      if (req.file) fs.unlinkSync(req.file.path);
    } catch { }
    try {
      fs.rmSync(outputDir, { recursive: true });
    } catch { }
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
  } catch { }
  meta.splice(idx, 1);
  writeMeta(meta);

  res.json({ message: "Video deleted" });
});

// ─── GET /api/admin/pdf/:id/document.pdf ─────────────────────────────────────
router.get("/pdf/:id/document.pdf", auth, (req, res) => {
  const videoId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const pdfPath = path.join(VIDEOS_DIR, videoId, "document.pdf");

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ message: "PDF not found" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=document.pdf");
  res.sendFile(pdfPath);
});

// ─── POST /api/admin/videos/:id/pdf ──────────────────────────────────────────
router.post("/videos/:id/pdf", auth, pdfUpload.single("pdf"), (req, res) => {
  const videoId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const meta = readMeta();
  const videoIdx = meta.findIndex((v) => v.id === videoId);

  if (videoIdx === -1) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: "Video not found" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "PDF file is required" });
  }

  try {
    const outputDir = path.join(VIDEOS_DIR, videoId);
    const pdfOutputPath = path.join(outputDir, "document.pdf");

    // Delete old PDF if exists
    if (fs.existsSync(pdfOutputPath)) {
      fs.unlinkSync(pdfOutputPath);
    }

    // Move new PDF
    fs.renameSync(req.file.path, pdfOutputPath);

    // Update meta with public video URL for PDF
    const pdfUrl = `/api/video/${videoId}/document.pdf`;
    meta[videoIdx].pdfUrl = pdfUrl;
    writeMeta(meta);

    res.json({
      message: "PDF added successfully!",
      pdfUrl,
    });
  } catch (err) {
    try {
      if (req.file) fs.unlinkSync(req.file.path);
    } catch { }
    console.error("PDF upload error:", err.message);
    res.status(500).json({
      message: "PDF upload failed",
      error: err.message,
    });
  }
});

// ─── DELETE /api/admin/videos/:id/pdf ────────────────────────────────────────
router.delete("/videos/:id/pdf", auth, (req, res) => {
  const videoId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const meta = readMeta();
  const videoIdx = meta.findIndex((v) => v.id === videoId);

  if (videoIdx === -1) {
    return res.status(404).json({ message: "Video not found" });
  }

  try {
    const pdfPath = path.join(VIDEOS_DIR, videoId, "document.pdf");
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    meta[videoIdx].pdfUrl = null;
    writeMeta(meta);

    res.json({ message: "PDF deleted successfully!" });
  } catch (err) {
    console.error("PDF delete error:", err.message);
    res.status(500).json({
      message: "PDF delete failed",
      error: err.message,
    });
  }
});

module.exports = router;
