import React, { useState, useEffect } from "react";
import VideoPlayer from "./VideoPlayer";
import { fetchVideos } from "./api";
import "./App.css";

function App() {
  const [videos, setVideos]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]  = useState(true);

  // ── Global protections (pure app pe) ──────────────────────────────────────
  useEffect(() => {
    // Right-click block globally
    const blockCtx = (e) => e.preventDefault();
    document.addEventListener("contextmenu", blockCtx);

    // Text selection block
    document.addEventListener("selectstart", (e) => e.preventDefault());

    // Drag block — video drag karke save na ho sake
    document.addEventListener("dragstart", (e) => e.preventDefault());

    return () => {
      document.removeEventListener("contextmenu", blockCtx);
    };
  }, []);

  useEffect(() => {
    fetchVideos()
      .then((data) => {
        console.log("Videos fetched:", data);
        const list = Array.isArray(data) ? data : [];
        setVideos(list);
        if (list.length > 0) setSelected(list[0]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span>▶</span> VaultStream
        </div>
        <div className="app-header-badge">🔒 Secure Content</div>
      </header>

      <div className="app-body">
        <div className="player-section">
          {selected ? (
            <>
              <VideoPlayer video={selected} userInfo="AmazDraw Animation Studio." />
              <h2 className="now-playing">{selected.title}</h2>
            </>
          ) : (
            <div className="no-video">
              {loading ? "Loading..." : "Koi video available nahi hai abhi."}
            </div>
          )}
        </div>

        <aside className="playlist">
          <h3 className="playlist-title">Videos ({videos.length})</h3>
          {videos.map((v) => (
            <div
              key={v.id}
              className={`playlist-item ${selected?.id === v.id ? "active" : ""}`}
              onClick={() => setSelected(v)}
            >
              <div className="playlist-thumb">▶</div>
              <div className="playlist-info">
                <div className="playlist-name">{v.title}</div>
                <div className="playlist-badge">🔐 HLS Encrypted</div>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

export default App;