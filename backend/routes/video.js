const express = require("express");
const path = require("path");
const fs = require("fs");
const auth = require("../middleware/auth");

const router = express.Router();

const VIDEOS_DIR = path.join(__dirname, "../videos");

function getBaseUrl(req) {
  // Railway pe req.protocol 'http' return karta hai, isliye hardcode
  const host = req.get("host") || req.headers.host;
  if (host && host.includes("railway.app")) {
    return "https://" + host;
  }
  // Local development ke liye original logic
  return `${req.protocol}://${host}`;
}

router.get("/:videoId/playlist.m3u8", auth, (req, res) => {
  const videoId = req.params.videoId.replace(/[^a-zA-Z0-9_-]/g, "");
  const playlistPath = path.join(VIDEOS_DIR, videoId, "playlist.m3u8");
  
  if (!fs.existsSync(playlistPath)) {
    return res.status(404).send("Playlist not found");
  }
  
  let playlist = fs.readFileSync(playlistPath, "utf8");
  const baseUrl = getBaseUrl(req);
  
  playlist = playlist.replace(/https?:\/\/[^\/]+\/api\/video\/[^\/]+\/enc\.key/g, 
    `${baseUrl}/api/video/${videoId}/enc.key?token=secure_token_123`);

  playlist = playlist.replace(/\.ts/g, '.ts?token=secure_qtoken_123');
  
  res.type("application/vnd.apple.mpegurl");
  res.send(playlist);
});

router.get("/:videoId/document.pdf", (req, res) => {
  const videoId = req.params.videoId.replace(/[^a-zA-Z0-9_-]/g, "");
  const pdfPath = path.join(VIDEOS_DIR, videoId, "document.pdf");
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ message: "PDF not found" });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(pdfPath);
});

router.get("/:videoId/:file", auth, (req, res) => {
  const videoId = req.params.videoId.replace(/[^a-zA-Z0-9_-]/g, "");
  const file    = req.params.file.replace(/[^a-zA-Z0-9_.\-]/g, "");
  const filePath = path.join(VIDEOS_DIR, videoId, file);
  res.sendFile(filePath);
});

module.exports = router;