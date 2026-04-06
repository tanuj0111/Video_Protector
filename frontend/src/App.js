import React, { useState, useEffect } from "react";
import VideoPlayer from "./VideoPlayer";
import { fetchVideos, BASE_URL } from "./api";
import "./App.css";

function App() {
  const [videos, setVideos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);

  useEffect(() => {
    const blockCtx = (e) => e.preventDefault();
    document.addEventListener("contextmenu", blockCtx);
    document.addEventListener("selectstart", (e) => e.preventDefault());
    document.addEventListener("dragstart", (e) => e.preventDefault());
    return () => document.removeEventListener("contextmenu", blockCtx);
  }, []);

  useEffect(() => {
    const load = () => {
      fetchVideos()
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setVideos(list);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  // Saare unique folders
  const folders = [...new Set(videos.map((v) => v.folder || "General"))].sort();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span>▶</span> Sample Animation
        </div>
        <div className="app-header-badge">🔒 Secure Content</div>
      </header>

      <div className="app-body">
        <div className="player-section">
          {selected ? (
            <>
              <VideoPlayer video={selected} userInfo="" />
              <h2 className="now-playing">{selected.title}</h2>
            </>
          ) : (
            <div className="no-video">
              {loading ? "Loading..." : "select a folder and video to play."}
            </div>
          )}
        </div>

        <aside className="playlist">
          <div className="playlist-header">
            <h3 className="playlist-title">
              {selectedFolder ? (
                <span
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onClick={() => {
                    setSelectedFolder(null);
                    setSelected(null);
                  }}
                >
                  <span style={{ fontSize: "18px" }}>←</span> {selectedFolder}
                </span>
              ) : (
                `Folders (${folders.length})`
              )}
            </h3>
          </div>

          <div className="playlist-scroll">
            {loading ? (
              <div
                style={{ color: "#aaa", padding: "20px", textAlign: "center" }}
              >
                Loading...
              </div>
            ) : selectedFolder === null ? (
              // ── Folder Cards ──
              folders.length === 0 ? (
                <div
                  style={{
                    color: "#aaa",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  No videos available. Please check back later.
                </div>
              ) : (
                folders.map((folder) => {
                  const count = videos.filter(
                    (v) => (v.folder || "General") === folder,
                  ).length;
                  return (
                    <div
                      key={folder}
                      onClick={() => setSelectedFolder(folder)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "14px 16px",
                        margin: "8px",
                        borderRadius: "10px",
                        background: "#1e1e2e",
                        cursor: "pointer",
                        border: "1px solid #333",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#2a2a3e")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#1e1e2e")
                      }
                    >
                      <span style={{ fontSize: "24px" }}>📁</span>
                      <div>
                        <div style={{ color: "#fff", fontWeight: "600" }}>
                          {folder}
                        </div>
                        <div style={{ color: "#aaa", fontSize: "12px" }}>
                          {count} video{count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // ── Videos List ──
              videos
                .filter((v) => (v.folder || "General") === selectedFolder)
                .map((v) => (
                  <div
                    key={v.id}
                    className={`playlist-item ${selected?.id === v.id ? "active" : ""}`}
                    onClick={() => setSelected(v)}
                  >
                    <div className="playlist-thumb">▶</div>
                    <div className="playlist-info">
                      <div className="playlist-name">{v.title}</div>
                      <div className="playlist-pdf-status">
                        {v.pdfUrl ? (
                          <a
                            href={
                              v.pdfUrl.startsWith("http")
                                ? v.pdfUrl
                                : `${BASE_URL}${v.pdfUrl}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            📄 PDF available
                          </a>
                        ) : (
                          <span className="pdf-none">PDF not available</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
