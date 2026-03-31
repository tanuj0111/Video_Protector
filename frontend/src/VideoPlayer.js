import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { BASE_URL, TOKEN } from "./api";
import "./Videoplayer.css";

const RATIOS = [
  { label: "16:9", value: "16/9" },
  { label: "9:16", value: "9/16" },
  { label: "1:1", value: "1/1" },
];

// ── Allowed single keys — jo press ho sakti hain akele ─────────────────────────
// Sirf yeh keys allowed hain: arrows, space (pause/play), F (fullscreen),
// M (mute), volume keys. Baaki sab block.
const ALLOWED_SINGLE_KEYS = new Set([
  "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyF", "KeyM", "KeyK",                  // play/pause/fullscreen/mute shortcuts
  "AudioVolumeUp", "AudioVolumeDown", "AudioVolumeMute",
  "MediaPlayPause", "MediaTrackNext", "MediaTrackPrevious",
  "MediaStop",
  "Tab", "Escape",                          // UI navigation
]);
const SCREENSHOT_KEYS = new Set([
  "PrintScreen",        // Windows — PrtSc
  "Snapshot",
  "MetaLeft",
  "MetaRight",
  "F13",
  // Kuch keyboards pe alag code hota hai
]);

export default function VideoPlayer({ video, userInfo = "user@vaultstream.local" }) {
  const videoRef = useRef();
  const wrapRef = useRef();
  const hlsRef = useRef();
  const pressedKeysRef = useRef(new Set());
  const isInternalActionRef = useRef(false);
  const isBlockedRef = useRef(false);
  const blockTimerRef = useRef(null);

  // setState refs — closures mein stale setState nahi milega
  const setBlockedRef = useRef(null);
  const setBlockReasonRef = useRef(null);

  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [ratio, setRatio] = useState("16/9");
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // setState functions ko refs mein store karo taaki closures mein fresh rahe
  setBlockedRef.current = setBlocked;
  setBlockReasonRef.current = setBlockReason;

  // triggerBlock ko ref mein rakho — har closure ko latest version milega
  const triggerBlockRef = useRef(null);
  triggerBlockRef.current = (reason = "Security violation detected") => {
    pressedKeysRef.current.clear();
    if (isBlockedRef.current) return;

    if (videoRef.current) videoRef.current.pause();

    isBlockedRef.current = true;
    isInternalActionRef.current = true;
    setBlockedRef.current(true);
    setBlockReasonRef.current(reason);


    if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
    blockTimerRef.current = setTimeout(() => {
      isBlockedRef.current = false;
      isInternalActionRef.current = false;
      pressedKeysRef.current.clear();
      setBlockedRef.current(false);
      setBlockReasonRef.current("");
      blockTimerRef.current = null;
    }, 30000);
  };

  // ── HLS Setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!video) return;
    const videoEl = videoRef.current;
    const src = `${BASE_URL}${video.playlistUrl}`;
    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();
      const hls = new Hls({
        xhrSetup: (xhr) => xhr.setRequestHeader("Authorization", TOKEN),
      });
      hls.loadSource(src);
      hls.attachMedia(videoEl);
      hlsRef.current = hls;
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = src;
    }
  }, [video]);

  // ── Tab hidden pe pause ────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => { if (document.hidden && videoRef.current) videoRef.current.pause(); };
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);

  // ── PiP block ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const block = () => {
      if (document.pictureInPictureElement)
        document.exitPictureInPicture().catch(() => { });
    };
    el.requestPictureInPicture = () =>
      Promise.reject(new DOMException("PiP disabled.", "NotAllowedError"));
    el.addEventListener("enterpictureinpicture", block);
    return () => el.removeEventListener("enterpictureinpicture", block);
  }, [video]);

  // ── FULL KEY BLOCK ─────────────────────────────────────────────────────────
  // Logic:
  //   1. Koi bhi modifier key (Ctrl, Alt, Meta/Cmd, Shift) akela ya kisi ke
  //      saath press hue = BLOCK (except Shift+Tab jo accessibility ke liye hai)
  //   2. Ek waqt mein 2+ keys pressed = BLOCK
  //   3. Sirf ALLOWED_SINGLE_KEYS set mein jo hain woh single press allowed
  //   4. Baaki sab — F1-F12, letters, numbers, symbols — sab block
  useEffect(() => {
    const pressed = pressedKeysRef.current;

    const onKeyDown = (e) => {
      // FIX: Block active hai toh har key silently block karo, pressed clear karo
      if (isBlockedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        pressed.clear();
        return false;
      }
      // Screenshot keys — explicitly block karo
      if (SCREENSHOT_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlockRef.current("Screenshot blocked");
        return false;
      }
      // SCREENSHOT_KEYS check ke baad yeh add karo onKeyDown mein:
      if (SCREENSHOT_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) videoRef.current.style.visibility = "hidden";
        triggerBlockRef.current("Screenshot blocked");
        setTimeout(() => {
          if (videoRef.current) videoRef.current.style.visibility = "visible";
        }, 2000);
        return false;
      }

      pressed.add(e.code);

      // Modifier key akeli bhi press hui toh turant block (Cmd hold = screenshot ready)
      const isModifierAlone = [
        "ControlLeft", "ControlRight",
        "AltLeft", "AltRight",
        "MetaLeft", "MetaRight",
        "ShiftLeft", "ShiftRight",
      ].includes(e.code);

      const hasModifier = e.ctrlKey || e.altKey || e.metaKey ||
        (e.shiftKey && e.code !== "Tab");

      // 2+ keys ek saath
      const multiKey = pressed.size >= 2;

      // Single blocked key
      const isSingleBlocked =
        !hasModifier &&
        pressed.size === 1 &&
        !ALLOWED_SINGLE_KEYS.has(e.code);

      if (isModifierAlone || hasModifier || multiKey || isSingleBlocked) {
        e.preventDefault();
        e.stopPropagation();

        const reason =
          isModifierAlone || hasModifier ? "Modifier key blocked" :
            multiKey ? "Multiple keys blocked" :
              "Key blocked by security policy";
        triggerBlockRef.current(reason);
        return false;
      }
    };

    const onKeyUp = (e) => {
      pressed.delete(e.code);
      // PrintScreen keyup pe bhi catch karo
      if (e.code === "PrintScreen") {
        if (videoRef.current) videoRef.current.style.visibility = "hidden";
        triggerBlockRef.current("Screenshot blocked");
        setTimeout(() => {
          if (videoRef.current) videoRef.current.style.visibility = "visible";
        }, 2000);
      }
    };

    // Capture phase (true) — browser shortcuts se pehle intercept karo
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);

    // Agar window focus kho de toh pressed keys clear karo
    // (warna stuck keys ka problem hota hai)
    const onBlurClear = () => pressed.clear();
    window.addEventListener("blur", onBlurClear);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlurClear);
    };
  }, []);

  // ── Blur fix — sirf external capture tools pe pause ───────────────────────
  useEffect(() => {
    let timer;
    const onBlur = () => {
      if (isInternalActionRef.current) return;
      timer = setTimeout(() => {
        if (!document.hidden && videoRef.current && !videoRef.current.paused)
          videoRef.current.pause();
      }, 500);
    };
    const onFocus = () => clearTimeout(timer);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearTimeout(timer);
    };
  }, []);

  // ── PHONE: Screen Recording Detection ─────────────────────────────────────
  // Android/iOS pe screen recording detect karne ke 3 browser-available methods:
  //
  // Method 1: MediaRecorder / getDisplayMedia — agar koi app ya browser extension
  //   screen record kar raha ho aur permission mili ho toh detect ho sakta hai
  //   (limited support, mostly desktop)
  //
  // Method 2: document.hidden + visibilitychange — iOS/Android pe screen
  //   recording shuru hone se pehle aksar OS ek brief visibility event fire
  //   karta hai. Yeh 100% reliable nahi lekin ek layer add karta hai.
  //
  // Method 3: orientationchange + resize during recording — kuch screen
  //   recorders (especially on Android) viewport resize trigger karte hain.
  //   Isse hum detect karke pause kar sakte hain.
  //
  // NOTE: iOS aur Android pe koi direct "isScreenRecording" API nahi hai
  // web browser ke liye. Native app mein FLAG_SECURE (Android) ya
  // UIScreen.isCaptured (iOS) use hota hai. Web pe hum best-effort karte hain.
  useEffect(() => {
    // Method 1: getDisplayMedia API monitor — agar tab capture ho rahi ho
    // (Chrome on Android supports this in some versions)
    let displayStream = null;
    const checkDisplayCapture = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          // Agar already capture chal rahi hai toh MediaDevices mein track milega
          const devices = await navigator.mediaDevices.enumerateDevices();
          // Display capture track active hai toh block karo
          const hasCapture = devices.some(
            (d) => d.kind === "videoinput" && d.label.toLowerCase().includes("screen")
          );
          if (hasCapture && videoRef.current && !videoRef.current.paused) {
            triggerBlockRef.current("Screen recording detected");
          }
        }
      } catch { }
    };

    // Method 2: iOS UIScreen.isCaptured equivalent — visibilitychange rapid fire
    let lastHidden = 0;
    const onVisibility = () => {
      const now = Date.now();
      if (document.hidden) {
        lastHidden = now;
      } else {
        // 300ms se kam mein wapas visible hua — screen recorder ka signature
        if (now - lastHidden < 300 && lastHidden > 0) {
          triggerBlockRef.current("Screen capture activity detected");
        }
      }
    };

    // Method 3: Viewport resize during recording (Android screen recorders)
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const onResize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      const dw = Math.abs(newW - lastW);
      const dh = Math.abs(newH - lastH);

      // Keyboard open/close = bada shift (150px+)
      // Recording bar = chota shift (20-40px)
      // Sirf height change check karo, width nahi
      if (dh > 10 && dh < 60 && dw === 0) {
        triggerBlockRef.current("Screen recording overlay detected");
      }

      lastW = newW;
      lastH = newH;
    };

    // Method 4: iOS Safari — ScreenOrientation + ambient light trick
    // iOS 17+ mein screen recording shuru hote hi ek brief orientation
    // recalculation hoti hai
    const onOrientationChange = () => {
      // Short delay pe check karo — recording indicator bar appear hoti hai
      setTimeout(() => {
        if (
          videoRef.current &&
          !videoRef.current.paused &&
          !document.hidden
        ) {
          // Agar screen height suddenly kam hui ho toh recording bar aa gayi
          if (window.screen.height - window.innerHeight > 40) {
            triggerBlockRef.current("Screen recording bar detected");
          }
        }
      }, 200);
    };

    // Polling — har 2s pe display capture check karo
    const pollInterval = setInterval(checkDisplayCapture, 15000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrientationChange);
    screen.orientation?.addEventListener("change", onOrientationChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientationChange);
      screen.orientation?.removeEventListener("change", onOrientationChange);
      if (displayStream) {
        displayStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Context / Copy / Drag block ───────────────────────────────────────────
  useEffect(() => {
    const b = (e) => e.preventDefault();
    const w = wrapRef.current;
    if (w) w.addEventListener("contextmenu", b);
    return () => { if (w) w.removeEventListener("contextmenu", b); };
  }, []);

  useEffect(() => {
    const b = (e) => { e.preventDefault(); e.stopPropagation(); };
    const w = wrapRef.current;
    if (!w) return;
    ["copy", "cut", "paste"].forEach((ev) => w.addEventListener(ev, b));
    return () => ["copy", "cut", "paste"].forEach((ev) => w.removeEventListener(ev, b));
  }, []);

  useEffect(() => {
    const b = (e) => e.preventDefault();
    ["dragstart", "dragover", "drop"].forEach((ev) => document.addEventListener(ev, b));
    return () => ["dragstart", "dragover", "drop"].forEach((ev) => document.removeEventListener(ev, b));
  }, []);

  // ── HLS health watchdog ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (videoRef.current) {
        const s = videoRef.current.readyState;
        if (s === 0 || s === 1) videoRef.current.load();
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  if (!video) return null;

  const maxWidth =
    ratio === "9/16" ? "360px" :
      ratio === "1/1" ? "560px" : "100%";

  return (
    <div className="player-outer" onContextMenu={(e) => e.preventDefault()}>

      {/* ── Ratio Selector ──────────────────────────────────────────────── */}
      <div className="ratio-bar">
        {RATIOS.map((r) => (
          <button
            key={r.value}
            className={`ratio-btn${ratio === r.value ? " ratio-btn--active" : ""}`}
            onClick={() => setRatio(r.value)}
            type="button"
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Ratio Box ───────────────────────────────────────────────────── */}
      <div
        className="ratio-box"
        ref={wrapRef}
        style={{ aspectRatio: ratio, maxWidth }}
      >
        {blocked && (
          <div className="screen-block">
            <div className="screen-block-icon">⛔</div>
            <div className="screen-block-text">Action Blocked</div>
            <div className="screen-block-reason">{blockReason}</div>
            <div className="screen-block-session">Session: {userInfo}</div>
          </div>
        )}

        <div className="video-shield" aria-hidden="true" />
        <DiagonalWatermark userInfo={userInfo} />

        <video
          ref={videoRef}
          controls
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{
            display: blocked ? "none" : "block",
            WebkitBackfaceVisibility: "hidden",
            transform: "translateZ(0)",
          }}
          playsInline
          preload="auto"
        />

        <div className="watermark">
          <span className="watermark-text">VaultStream • Protected</span>
          <span className="watermark-time">{time}</span>
        </div>
      </div>
    </div>
  );
}

// ── Diagonal Canvas Watermark ─────────────────────────────────────────────────
function DiagonalWatermark({ userInfo }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const W = canvas.offsetWidth || 640;
      const H = canvas.offsetHeight || 360;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.font = "bold 13px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 6);
      const label = `${userInfo}  •  VaultStream  •  Protected`;
      const diag = Math.ceil(Math.sqrt(W * W + H * H));
      const colSpc = 200, rowSpc = 55;
      const cols = Math.ceil(diag / colSpc) + 2;
      const rows = Math.ceil(diag / rowSpc) + 2;
      for (let i = -cols; i <= cols; i++)
        for (let j = -rows; j <= rows; j++)
          ctx.fillText(label, i * colSpc, j * rowSpc);
      ctx.restore();
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [userInfo]);

  return <canvas ref={canvasRef} className="diagonal-watermark" aria-hidden="true" style={{ willChange: "transform" }} />;
}