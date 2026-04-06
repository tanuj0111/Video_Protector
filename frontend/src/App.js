import React, { useState, useEffect } from "react";
import VideoPlayer from "./VideoPlayer";
import { fetchVideos, BASE_URL } from "./api";
import "./App.css";

function App() {
  const [videos, setVideos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);

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
    const load = () => {
      fetchVideos()
        .then((data) => {
          console.log("Videos fetched:", data);
          const list = Array.isArray(data) ? data : [];
          setVideos(list);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Fetch error:", err);
          setLoading(false);
        });
    };

    load(); // pehli baar load karo
    const interval = setInterval(load, 10000); // har 10 second mein refresh
    return () => clearInterval(interval); // cleanup
  }, []);

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
              {loading
                ? "Loading..."
                : "No video available right now please select you folder."}
            </div>
          )}
        </div>

        <aside className="playlist">
          <div className="playlist-header">
            <h3 className="playlist-title">Videos ({videos.length})</h3>

            {/* Folder Dropdown */}
            <div className="folder-filter">
              <select
                className="folder-select"
                value={selectedFolder}
               onChange={(e) => setSelectedFolder(e.target.value === "All" ? "All" : e.target.value)}
              >
                <option value="All">All Folders</option>
                {[...new Set(videos.map((v) => v.folder || "General"))]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .sort()
                  .map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="playlist-scroll">
            {selectedFolder === null ? (
              <div
                style={{ color: "#aaa", padding: "20px", textAlign: "center" }}
              >
               select your folder
              </div>
            ) : (
              videos
                .filter(
                  (v) =>
                    selectedFolder === "All" ||
                    (v.folder || "General") === selectedFolder,
                )
                .map((v) => (
                  <div
                    key={v.id}
                    className={`playlist-item ${selected?.id === v.id ? "active" : ""}`}
                    onClick={() => setSelected(v)}
                  >
                    <div className="playlist-thumb">▶</div>
                    <div className="playlist-info">
                      <div className="playlist-name">{v.title}</div>
                      {/* <div className="playlist-badge">🔐 HLS Encrypted</div> */}
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
