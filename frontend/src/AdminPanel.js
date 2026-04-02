import React, { useState, useEffect, useRef } from "react";
import { fetchVideos, uploadVideo, deleteVideo, uploadPdf, deletePdf } from "./api";
import "./AdminPanel.css";

export default function AdminPanel() {
  const [videos, setVideos] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', msg }
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [pdfUploadingId, setPdfUploadingId] = useState(null);
  const fileInputRef = useRef();
  const pdfInputRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchVideos();
      setVideos(Array.isArray(data) ? data : []);
    } catch {
      setStatus({ type: "error", msg: "Server se connect nahi ho paya" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFile = (f) => {
    if (f && f.type.startsWith("video/")) setFile(f);
    else setStatus({ type: "error", msg: "Sirf video files allowed hain" });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!title.trim()) return setStatus({ type: "error", msg: "Title mandatory" });
    if (!file) return setStatus({ type: "error", msg: "Select a video file" });

    setUploading(true);
    setProgress(0);
    setStatus(null);

    try {
      const res = await uploadVideo(title, file, setProgress);
      if (res.video) {
        setStatus({ type: "success", msg: `"${res.video.title}" upload ho gaya!` });
        setTitle("");
        setFile(null);
        setProgress(0);
        await load();
      } else {
        setStatus({ type: "error", msg: res.message || "Upload fail ho gaya" });
      }
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
    setUploading(false);
  };

  const handleDelete = async (id, videoTitle) => {
    if (!window.confirm(`"${videoTitle}" delete karna chahte ho?`)) return;
    try {
      await deleteVideo(id);
      setStatus({ type: "success", msg: `"${videoTitle}" delete ho gaya` });
      await load();
    } catch {
      setStatus({ type: "error", msg: "Delete fail ho gaya" });
    }
  };

  const handleUploadPdf = async (videoId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e) => {
      const pdfFile = e.target.files?.[0];
      if (!pdfFile) return;
      
      if (pdfFile.type !== "application/pdf") {
        setStatus({ type: "error", msg: "Sirf PDF files allowed hain" });
        return;
      }

      setPdfUploadingId(videoId);
      try {
        const res = await uploadPdf(videoId, pdfFile);
        setStatus({ type: "success", msg: "PDF add ho gaya!" });
        await load();
      } catch (e) {
        setStatus({ type: "error", msg: e.message || "PDF upload fail ho gaya" });
      }
      setPdfUploadingId(null);
    };
    input.click();
  };

  const handleDeletePdf = async (videoId) => {
    if (!window.confirm("PDF delete karna chahte ho?")) return;
    try {
      await deletePdf(videoId);
      setStatus({ type: "success", msg: "PDF delete ho gaya" });
      await load();
    } catch {
      setStatus({ type: "error", msg: "Delete fail ho gaya" });
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="admin-root">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">▶</span>
          <span className="logo-text">VaultStream</span>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-item active">
            <span>⊞</span> Dashboard
          </a>
          <a className="nav-item">
            <span>↑</span> Upload
          </a>
          <a className="nav-item">
            <span>⚙</span> Settings
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="video-quota">
            <div className="quota-label">Total Videos</div>
            <div className="quota-bar">
              <div className="quota-fill" style={{ width: `100%` }} />
            </div>
            <div className="quota-count">{videos.length} videos</div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1 className="page-title">Admin Panel</h1>
            <p className="page-sub">Apni secure HLS videos manage karo</p>
          </div>
          <div className="header-badge">
            <span className="dot" /> Live
          </div>
        </header>

        {/* Status */}
        {status && (
          <div className={`status-bar ${status.type}`}>
            {status.type === "success" ? "✓" : "✕"} {status.msg}
            <button className="status-close" onClick={() => setStatus(null)}>×</button>
          </div>
        )}

        {/* ── Upload Card ── */}
        <section className="card upload-card">
          <h2 className="card-title">
            <span className="card-icon">↑</span> upload new video
          </h2>

          <div className="upload-form">
            <div className="field">
              <label className="field-label">Video Title *</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. Introduction to React..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                maxLength={80}
              />
              <span className="char-count">{title.length}/80</span>
            </div>

            <div className="field">
              <label className="field-label">Video File *</label>
              <div
                className={`drop-zone ${dragOver ? "drag-active" : ""} ${file ? "has-file" : ""}`}
                onClick={() => !uploading && fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="file-info">
                    <span className="file-icon">🎬</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                    {!uploading && (
                      <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); }}>×</button>
                    )}
                  </div>
                ) : (
                  <div className="drop-placeholder">
                    <div className="drop-icon">☁</div>
                    <div className="drop-text">drag video here</div>
                    <div className="drop-sub">MP4, MOV, MKV, AVI, WebM • Max 500MB</div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              />
            </div>

            {uploading && (
              <div className="progress-wrap">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-text">
                  {progress < 100 ? `Uploading... ${progress}%` : "Converting to HLS... Please wait"}
                </span>
              </div>
            )}

            <button
              className="upload-btn"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <><span className="spinner" /> Processing...</>
              ) : (
                <><span>↑</span> Upload & Convert to HLS</>
              )}
            </button>
          </div>
        </section>

        {/* ── Videos List ── */}
        <section className="card videos-card">
          <h2 className="card-title">
            <span className="card-icon">⊞</span> Uploaded Videos
            <span className="video-count">{videos.length}</span>
          </h2>

          {loading ? (
            <div className="loading-state">
              <div className="spinner large" /> Loading...
            </div>
          ) : videos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📹</div>
              <p>Koi video nahi hai abhi.<br />Upar se pehli video upload karo!</p>
            </div>
          ) : (
            <div className="videos-list">
              {videos.map((v, i) => (
                <div className="video-row" key={v.id}>
                  <div className="video-thumb">
                    <span>{i + 1}</span>
                  </div>
                  <div className="video-info">
                    <div className="video-title">{v.title}</div>
                    <div className="video-meta">
                      <span className="hls-badge">HLS</span>
                      <span className="video-date">{formatDate(v.uploadedAt)}</span>
                    </div>
                    <div className="video-id">{v.id}</div>
                    <div className="video-pdf-status">
                      {v.pdfUrl ? (
                        <a href={v.pdfUrl} target="_blank" rel="noreferrer">📄 PDF available</a>
                      ) : (
                        <span className="pdf-none">PDF nahi hai</span>
                      )}
                    </div>
                  </div>
                  <div className="video-actions">
                    {v.pdfUrl ? (
                      <button
                        className="pdf-btn"
                        onClick={() => handleDeletePdf(v.id)}
                        title="PDF delete karo"
                        disabled={pdfUploadingId === v.id}
                      >
                        {pdfUploadingId === v.id ? "⏳" : "📄"} Delete PDF
                      </button>
                    ) : (
                      <button
                        className="pdf-btn add"
                        onClick={() => handleUploadPdf(v.id)}
                        title="PDF add karo"
                        disabled={pdfUploadingId === v.id}
                      >
                        {pdfUploadingId === v.id ? "⏳" : "📄"} Add PDF
                      </button>
                    )}
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(v.id, v.title)}
                      title="Delete karo"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
