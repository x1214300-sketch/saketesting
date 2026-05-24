/* =============================================================
   清酒試飲會 — React 主應用
   單檔架構：Intro → Stage → Evaluation → Discussion → Cart → LiveWall
   無 build step：在 <script type="text/babel"> 中執行
   ============================================================= */
/* global React, ReactDOM */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ----------------------------------------------------------------
   1. Web Audio 音效（程式合成，無外部檔）
   ---------------------------------------------------------------- */
let _audioCtx = null;
function getAudio() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
  }
  // iOS 在使用者首次互動時 resume
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

function envGain(ctx, dur, peak = 0.3) {
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  return g;
}

// 開瓶「啵」+ 氣泡聲
function playPopAndFizz() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  // pop
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(180, now);
  o.frequency.exponentialRampToValueAtTime(60, now + 0.18);
  const g = envGain(ctx, 0.22, 0.5);
  o.connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 0.25);

  // fizz（白噪音 high-pass）
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.9, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, now + 0.15);
  ng.gain.linearRampToValueAtTime(0.12, now + 0.22);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  noise.connect(hp).connect(ng).connect(ctx.destination);
  noise.start(now + 0.15); noise.stop(now + 1.2);
}

// 飲用「咕嚕」
function playGulp() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    o.type = "sine";
    const start = now + i * 0.16;
    o.frequency.setValueAtTime(220 + i * 30, start);
    o.frequency.exponentialRampToValueAtTime(100, start + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.25, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(start); o.stop(start + 0.2);
  }
}

// 配餐「咀嚼」（短促）
function playEat() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 360 - i * 60;
    const g = envGain(ctx, 0.1, 0.18);
    o.connect(g).connect(ctx.destination);
    const t = now + i * 0.12;
    o.start(t); o.stop(t + 0.1);
  }
}

// 飛機（產區飛行）
function playAirplane() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(80, now);
  o.frequency.linearRampToValueAtTime(220, now + 0.6);
  o.frequency.linearRampToValueAtTime(80, now + 1.2);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
  const g = envGain(ctx, 1.3, 0.18);
  o.connect(lp).connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 1.3);
}

// 鈴
function playBell() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = envGain(ctx, 0.9, 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.08); o.stop(now + 0.95);
  });
}

// 倒酒咕嚕（連續低音）
function playPour() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  // 連續低音 + 隨機抖動
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, now);
  const lfo = ctx.createOscillator();
  lfo.type = "sine"; lfo.frequency.value = 12;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 22;
  lfo.connect(lfoGain).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.1);
  g.gain.setValueAtTime(0.22, now + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  o.connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 1.85);
  lfo.start(now); lfo.stop(now + 1.85);

  // 噴頭白噪音
  const buf = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  const n = ctx.createBufferSource(); n.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, now);
  ng.gain.linearRampToValueAtTime(0.08, now + 0.15);
  ng.gain.setValueAtTime(0.08, now + 1.4);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
  n.connect(bp).connect(ng).connect(ctx.destination);
  n.start(now); n.stop(now + 1.75);
}

/* ----------------------------------------------------------------
   2. localStorage 持久化
   ---------------------------------------------------------------- */
const LS_KEY = "sake-tasting-v1";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 同日才回覆
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.day !== today) return null;
    return parsed;
  } catch { return null; }
}
function saveState(patch) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = loadState() || {};
    const merged = { ...existing, ...patch, day: today };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {}
}
function clearState() { try { localStorage.removeItem(LS_KEY); } catch {} }

/* ----------------------------------------------------------------
   3. SSI 象限色判定
   ---------------------------------------------------------------- */
function ssiQuadrantKey(ssi) {
  // x: 風味濃淡 (0 輕 → 100 濃)
  // y: 香氣高低 (0 低 → 100 高)
  if (!ssi) return "sou";
  const { x, y } = ssi;
  if (x < 50 && y >= 50) return "kun";   // 薰：高香低味
  if (x < 50 && y < 50)  return "sou";   // 爽：低香低味
  if (x >= 50 && y < 50) return "jun";   // 醇：低香高味
  return "juku";                         // 熟：高香高味
}

/* ----------------------------------------------------------------
   4. 通用：陀螺儀許可（iOS）
   ---------------------------------------------------------------- */
function requestGyroPerm() {
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission().catch(() => {});
  }
}

const REGION_MAPS = [
  { id: 1, label: "京都府", query: "池田酒造 京都府 舞鶴市", lat: 35.47, lng: 135.39, pinX: 45, pinY: 73 },
  { id: 2, label: "群馬縣", query: "聖酒造 群馬県 渋川市", lat: 36.49, lng: 139.00, pinX: 70, pinY: 48 },
  { id: 3, label: "櫪木縣", query: "虎屋本店 栃木県 宇都宮市", lat: 36.56, lng: 139.88, pinX: 75, pinY: 49 },
  { id: 4, label: "長野縣", query: "小野酒造店 長野県 辰野町", lat: 35.98, lng: 137.99, pinX: 61, pinY: 57 },
  { id: 5, label: "京都府", query: "白杉酒造 京都府 京丹後市", lat: 35.62, lng: 135.06, pinX: 43, pinY: 72 },
  { id: 6, label: "埼玉県", query: "麻原酒造 埼玉県 毛呂山町", lat: 35.94, lng: 139.32, pinX: 70, pinY: 55 },
  { id: 7, label: "兵庫縣", query: "山名酒造 兵庫県 丹波市", lat: 35.18, lng: 135.04, pinX: 38, pinY: 78 },
];

/* ================================================================
   元件：BottleStage — 偽 3D 酒瓶舞台
   ================================================================ */
function BottleStage({ sake, opened, onOpen }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [shake, setShake] = useState(false);
  const [capFly, setCapFly] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const halo = ssiQuadrantKey(sake.ssi);

  // 光斑：mouse / touch 更新 CSS 變數
  const handlePointer = useCallback((e) => {
    const el = imgRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${Math.max(0, Math.min(100, x))}%`);
    el.style.setProperty("--my", `${Math.max(0, Math.min(100, y))}%`);
  }, []);

  // 陀螺儀視差（3~5 度）
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    let active = true;
    function onOrient(ev) {
      if (!active) return;
      const beta = ev.beta || 0;   // 前後傾 -180~180
      const gamma = ev.gamma || 0; // 左右傾 -90~90
      // 限制 ±5 度（rotateY 用 gamma、rotateX 用 beta）
      const ry = Math.max(-5, Math.min(5, gamma / 6));
      const rx = Math.max(-5, Math.min(5, (beta - 30) / 8));
      wrap.style.transform = `rotateY(${ry}deg) rotateX(${-rx}deg)`;
    }
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      active = false;
      window.removeEventListener("deviceorientation", onOrient);
      if (wrap) wrap.style.transform = "";
    };
  }, []);

  // 開瓶觸發
  function handleTap() {
    if (opened) return;
    requestGyroPerm(); // 第一次點擊請求陀螺儀
    setShake(true);
    setTimeout(() => setShake(false), 320);
    setTimeout(() => setCapFly(true), 280);
    // 生成 10 個氣泡
    const newBubbles = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      bx: (Math.random() - 0.5) * 80,
      delay: Math.random() * 0.4,
    }));
    setBubbles(newBubbles);
    playPopAndFizz();
    setTimeout(() => {
      onOpen();
    }, 950);
    setTimeout(() => setBubbles([]), 2200);
  }

  return (
    <div
      className="bottle-stage"
      onMouseMove={handlePointer}
      onTouchMove={handlePointer}
      onClick={handleTap}
    >
      <div className={`stage-halo halo-${halo}`} />
      <StageRegionMap sake={sake} />

      <div ref={wrapRef} className="bottle-wrap" style={{ transition: "transform 0.2s ease" }}>
        {/* 倒影 */}
        <img className="bottle-reflection" src={sake.bottleImage} alt="" aria-hidden />

        {/* 瓶身 */}
        <div className={`relative h-full flex items-end ${shake ? "bottle-shake" : ""}`}>
          <img
            ref={imgRef}
            className="bottle-img"
            src={sake.bottleImage}
            alt={sake.name}
            draggable="false"
          />
          <div className="bottle-img-mask" />
        </div>

        {/* 瓶蓋飛出 overlay（簡版：直接以 CSS 矩形模擬，不用額外圖片） */}
        {capFly && <div className="cap-overlay cap-fly" />}

        {/* 氣泡 */}
        {bubbles.map(b => (
          <span
            key={b.id}
            className="bubble"
            style={{ "--bx": `${b.bx}px`, animationDelay: `${b.delay}s` }}
          />
        ))}
      </div>

      {!opened && <div className="tap-hint">點酒瓶開瓶</div>}
    </div>
  );
}

/* ================================================================
   元件：SSI 四象限
   ================================================================ */
function SSIChart({ ssi, label }) {
  if (!ssi) return null;
  return (
    <div className="ssi-grid">
      <svg
        className="ssi-grid-svg"
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="0.5" y="0.5" width="99" height="99" rx="7" className="ssi-grid-frame" />
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => (
          <React.Fragment key={`grid-${v}`}>
            <line x1={v} y1="0" x2={v} y2="100" className={v === 50 ? "ssi-grid-axis" : "ssi-grid-line"} />
            <line x1="0" y1={v} x2="100" y2={v} className={v === 50 ? "ssi-grid-axis" : "ssi-grid-line"} />
          </React.Fragment>
        ))}
      </svg>
      <span className="ssi-axis-sticker ssi-axis-top">香氣高</span>
      <span className="ssi-axis-sticker ssi-axis-bottom">香氣低</span>
      <span className="ssi-axis-sticker ssi-axis-left">風味淡</span>
      <span className="ssi-axis-sticker ssi-axis-right">風味濃</span>
      <span className="ssi-quad-large ssi-quad-kun">薰</span>
      <span className="ssi-quad-large ssi-quad-juku">熟</span>
      <span className="ssi-quad-large ssi-quad-sou">爽</span>
      <span className="ssi-quad-large ssi-quad-jun">醇</span>
      <div className="ssi-dot" style={{ left: `${ssi.x}%`, bottom: `${ssi.y}%` }} />
    </div>
  );
}

/* ================================================================
   元件：酒瓶舞台產區地圖指標
   ================================================================ */
function StageRegionMap({ sake }) {
  const active = REGION_MAPS.find(m => m.id === sake.id) || REGION_MAPS[0];
  const mapTarget = active?.lat && active?.lng ? `${active.lat},${active.lng}` : (active?.query || `${sake.brewery} ${sake.region}`);
  const mapSrc = `https://maps.google.com/maps?ll=37.5,137.5&z=5&t=m&q=${encodeURIComponent(mapTarget)}&output=embed`;
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    setMapLoaded(false);
  }, [mapSrc]);

  return (
    <div className="stage-region-map" aria-label={`${sake.name} 產區：${sake.region}`}>
      <div className="stage-region-map-frame" role="img" aria-label={`Google Maps 顯示目前酒款產區：${active.label}`}>
        <div className="stage-region-map-fallback" aria-hidden="true">
          <StageJapanFallbackMap active={active} />
        </div>
        <iframe
          className={`stage-region-map-iframe ${mapLoaded ? "loaded" : ""}`}
          title={`${sake.name} Google Maps 產區地圖`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          tabIndex="-1"
          onLoad={() => setMapLoaded(true)}
        />
      </div>
      <div className="stage-region-label">
        <span className="stage-region-pin">📍</span>
        <span>{active.label}</span>
      </div>
    </div>
  );
}

function StageJapanFallbackMap({ active }) {
  return (
    <svg className="stage-region-fallback-svg" viewBox="0 0 120 150" aria-hidden="true" focusable="false">
      <rect className="stage-region-sea" x="0" y="0" width="120" height="150" rx="8" />
      <path className="stage-region-land" d="M79 7 C90 2 106 7 113 18 C108 29 95 36 83 32 C75 29 71 20 75 12 C72 11 74 8 79 7 Z" />
      <path className="stage-region-land" d="M72 31 C78 29 83 32 85 37 C79 39 73 38 69 34 C69 33 70 32 72 31 Z" />
      <path className="stage-region-land main-island" d="M83 39 C93 40 100 47 97 57 C94 66 85 67 79 72 C73 78 71 88 62 92 C54 96 51 106 42 110 C34 114 26 109 31 101 C35 94 44 92 48 86 C53 79 59 76 61 68 C63 58 70 52 76 47 C80 44 79 40 83 39 Z" />
      <path className="stage-region-land" d="M57 70 C49 66 50 58 59 55 C65 60 64 67 57 70 Z" />
      <path className="stage-region-land" d="M55 91 C64 93 69 101 63 109 C57 106 53 98 55 91 Z" />
      <path className="stage-region-land" d="M83 67 C92 69 94 78 87 83 C82 79 80 72 83 67 Z" />
      <path className="stage-region-land" d="M42 104 C45 102 48 104 48 107 C45 109 42 108 40 106 C40 105 41 104 42 104 Z" />
      <path className="stage-region-land main-island" d="M39 108 C49 103 62 105 68 112 C59 119 43 120 33 114 C33 111 35 109 39 108 Z" />
      <path className="stage-region-land main-island" d="M22 115 C31 106 44 109 47 121 C45 135 34 145 21 139 C10 133 12 123 22 115 Z" />
      <path className="stage-region-land" d="M23 138 C27 141 27 146 23 149 C18 146 18 141 23 138 Z" />
      <g className="stage-region-active-pin" transform={`translate(${active.pinX * 1.2} ${active.pinY * 1.5})`}>
        <circle cx="0" cy="-8" r="7" />
        <path d="M0 4 L-4 -4 L4 -4 Z" />
        <circle className="stage-region-active-pin-core" cx="0" cy="-8" r="2.6" />
      </g>
    </svg>
  );
}

/* ================================================================
   元件：Carousel
   ================================================================ */
function ScrollHint() {
  return <p className="scroll-hint">← 左右滑動瀏覽 →</p>;
}

function Carousel({ items, render }) {
  return (
    <div className="carousel pb-2">
      {items.map((it, i) => (
        <div className="carousel-card" key={i}>{render(it, i)}</div>
      ))}
    </div>
  );
}

/* ================================================================
   元件：Modal Sheet
   ================================================================ */
function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-ink">{title}</h3>
          <button className="jelly-btn text-2xl text-muted px-2" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   元件：Star Rating 1~10
   ================================================================ */
function StarRating({ value, onChange, max = 10 }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`star ${i < value ? "active" : ""}`}
          onClick={() => onChange(i + 1)}
        >★</span>
      ))}
    </div>
  );
}

/* ================================================================
   元件：Chip Group（複選 + 自填）
   ================================================================ */
function ChipGroup({ options, selected, onToggle, custom, setCustom }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center mb-3">
        {options.map(opt => (
          <span
            key={opt}
            className={`chip jelly-btn ${selected.includes(opt) ? "chip-selected" : ""}`}
            onClick={() => onToggle(opt)}
          >{opt}</span>
        ))}
      </div>
      <input
        type="text"
        className="w-full px-4 py-2 rounded-full border border-gray-200 bg-white text-sm"
        placeholder="自填其他（可選）"
        value={custom || ""}
        onChange={e => setCustom(e.target.value)}
      />
    </div>
  );
}

/* ================================================================
   主畫面：Intro
   ================================================================ */
function IntroScreen({ stores, onPick }) {
  return (
    <div className="px-5 py-8 fade-in">
      <div className="text-center mb-8">
        <p className="text-gold text-xs tracking-[0.4em] font-bold mb-2">SAKE TASTING 2026</p>
        <h1 className="text-4xl font-bold mb-3">清酒試飲會</h1>
        <p className="text-muted text-sm leading-relaxed">
          開瓶 · 品味 · 評鑑 · 議題討論<br/>
          一人一杯，七款清酒的旅程
        </p>
      </div>

      <div className="glass-panel p-5 mb-5">
        <p className="text-xs font-bold text-gold tracking-widest mb-3">請選擇您的店家</p>
        <div className="grid grid-cols-2 gap-2">
          {stores.map(s => (
            <button
              key={s}
              className="jelly-btn btn-outline text-sm py-3"
              onClick={() => onPick(s)}
            >{s}</button>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted">
        ※ 您的選擇與評鑑會自動儲存於本機，僅於當日有效。
      </p>
    </div>
  );
}

/* ================================================================
   主畫面：Stage 第 N 款酒
   ================================================================ */
function StageScreen({ sake, index, total, onStartEval, opened, setOpened }) {
  const [sheet, setSheet] = useState(null); // story / aroma / taste / pairing / region

  // 進入下一款酒重設「開瓶」狀態
  // (在 App 層用 key 重置；此元件僅讀 props)

  const infoButtons = [
    { key: "story",  emoji: "🏛️", label: "酒造故事", sound: playBell },
    { key: "aroma",  emoji: "✨", label: "香氣定位", sound: playBell },
    { key: "taste",  emoji: "🍶", label: "飲用口感", sound: playBell },
    { key: "pair",   emoji: "🥢", label: "餐點搭配", sound: playBell },
    { key: "region", emoji: "🗺️", label: "產區介紹", sound: playBell },
  ];

  return (
    <div className="fade-in">
      {/* 頂部進度 */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted tracking-widest">
            #{String(index + 1).padStart(2,"0")} / 共 {total} 款
          </span>
          <span className="text-xs text-gold font-bold">{sake.ssiQuadrant}</span>
        </div>
        <div className="progress-pill">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`pill ${i <= index ? "done" : ""}`} />
          ))}
        </div>
      </div>

      {/* 酒名 */}
      <div className="text-center px-5 pt-2">
        <h2 className="text-2xl font-bold leading-tight">{sake.name}</h2>
        <p className="text-xs text-muted mt-1">{sake.brewery} · {sake.region}</p>
      </div>

      {/* 酒瓶舞台 */}
      <BottleStage sake={sake} opened={opened} onOpen={() => setOpened(true)} />

      {/* 五個資訊按鈕 — 開瓶後才出現 */}
      {opened && (
        <div className="px-5 mt-2 fade-in">
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {infoButtons.map(b => (
              <button
                key={b.key}
                className="jelly-btn glass-panel py-3 px-1 text-center"
                onClick={() => { b.sound && b.sound(); setSheet(b.key); }}
              >
                <div className="text-2xl">{b.emoji}</div>
                <div className="text-[10px] mt-1 font-bold text-ink">{b.label}</div>
              </button>
            ))}
          </div>

          <button
            className="jelly-btn btn-gold w-full text-base"
            onClick={onStartEval}
          >開始評鑑儀式 →</button>
        </div>
      )}

      {/* 各種 Sheet */}
      <Sheet open={sheet === "story"} onClose={() => setSheet(null)} title="🏛️ 酒造故事">
        <ScrollHint />
        <Carousel
          items={sake.breweryStorySlides}
          render={(s) => (
            <div className="story-card">
              {s.img && (
                <img
                  className="story-card-img"
                  src={s.img}
                  alt={`${sake.brewery} - ${s.title}`}
                  loading="lazy"
                />
              )}
              <h4 className="font-bold text-lg mb-2 text-gold">{s.title}</h4>
              <p className="text-sm leading-relaxed break-word">{s.desc}</p>
            </div>
          )}
        />
      </Sheet>

      <Sheet open={sheet === "aroma"} onClose={() => setSheet(null)} title="✨ 香氣定位">
        <div className="mb-4">
          <SSIChart ssi={sake.ssi} label={sake.ssiQuadrant} />
        </div>
        <p className="text-xs text-muted mb-2">SSI 4 象限：香氣高低 × 風味濃淡</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {sake.aromaTags.map(t => (
            <span key={t} className="chip chip-aroma">{t}</span>
          ))}
        </div>
        <p className="text-sm leading-relaxed break-word">{sake.aromaDesc}</p>
        <p className="text-[11px] text-muted mt-3 italic">{sake.ssiReason}</p>
      </Sheet>

      <Sheet open={sheet === "taste"} onClose={() => setSheet(null)} title="🍶 飲用口感">
        <div className="bg-paper rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-gold mb-2 tracking-widest">日本酒度（SMV）</p>
          {sake.smv !== null ? (
            <div>
              <input
                type="range"
                className="sake-range"
                min="-15" max="20" value={sake.smv}
                readOnly
              />
              <div className="flex justify-between text-[11px] text-muted mt-1">
                <span>← 甘口</span>
                <b className="text-gold">{sake.smvLabel}</b>
                <span>辛口 →</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">{sake.smvLabel}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">酒精度</span><br/><b>{sake.abv}</b>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">酸度</span><br/><b>{sake.acidityLabel || "—"}</b>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">酒米</span><br/><b>{sake.rice}</b>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">精米</span><br/><b>{sake.polish}</b>
          </div>
        </div>
        <p className="text-sm leading-relaxed break-word">{sake.tasteDesc}</p>
      </Sheet>

      <Sheet open={sheet === "pair"} onClose={() => setSheet(null)} title="🥢 餐點搭配">
        <ScrollHint />
        <Carousel items={sake.pairingDetails} render={(p) => (
            <div className="info-card">
              {p.img && <img className="info-card-img" src={p.img} alt={p.title} loading="lazy" />}
              <div className="flex justify-between items-start mb-1">
                <b className="text-sm">{p.title}</b>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white" style={{ color: "#B8860B", border: "1px solid rgba(184,134,11,0.4)" }}>
                  {p.type}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed break-word">{p.reason}</p>
            </div>
        )} />
      </Sheet>

      <Sheet open={sheet === "region"} onClose={() => setSheet(null)} title="🗺️ 產區介紹">
        <p className="text-xs text-gold font-bold tracking-widest mb-2">⛩️ 觀光景點</p>
        <ScrollHint />
        <Carousel items={sake.sightseeing} render={(x) => (
          <div className="info-card-plain">
            {x.img && <img className="info-card-img" src={x.img} alt={x.title} loading="lazy" />}
            <h4 className="font-bold mb-1">{x.title}</h4>
            <p className="text-xs text-muted break-word">{x.desc}</p>
          </div>
        )} />
        <p className="text-xs text-gold font-bold tracking-widest mt-4 mb-2">🍡 當地名產</p>
        <ScrollHint />
        <Carousel items={sake.specialties} render={(x) => (
          <div className="info-card-plain">
            {x.img && <img className="info-card-img" src={x.img} alt={x.title} loading="lazy" />}
            <h4 className="font-bold mb-1">{x.title}</h4>
            <p className="text-xs text-muted break-word">{x.desc}</p>
          </div>
        )} />
      </Sheet>
    </div>
  );
}

/* ================================================================
   主畫面：Evaluation 5 步驟評鑑儀式
   ================================================================ */
const AROMA_OPTS = ["🍒 果香","🌸 花香","🌾 米香","🍋 柑橘","🌰 堅果","🍯 蜜甜","🪨 礦石","🥛 乳酸","🍂 熟成","🫧 氣泡"];
const PAIR_OPTS  = ["生魚片","壽司","烤魚","燒肉","天婦羅","燉煮","起司","甜點","蔬食","湯品"];

function EvaluationScreen({ sake, initial, onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [aroma, setAroma] = useState(initial?.aroma || []);
  const [aromaCustom, setAromaCustom] = useState(initial?.aromaCustom || "");
  const [sweetness, setSweetness] = useState(initial?.sweetness || 3);
  const [acidityScore, setAcidityScore] = useState(initial?.acidityScore || 3);
  const [body, setBody] = useState(initial?.body || 3);
  const [alcohol, setAlcohol] = useState(initial?.alcohol || 3);
  const [pair, setPair] = useState(initial?.pair || []);
  const [pairCustom, setPairCustom] = useState(initial?.pairCustom || "");
  const [note, setNote] = useState(initial?.note || "");
  const [rating, setRating] = useState(initial?.rating || 0);
  const [remain, setRemain] = useState(30);
  const [timeUp, setTimeUp] = useState(false);

  // 30 秒倒數
  useEffect(() => {
    setRemain(30); setTimeUp(false);
    const t = setInterval(() => {
      setRemain(r => {
        if (r <= 1) { clearInterval(t); setTimeUp(true); playBell(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const steps = [
    { title: "1. 香氣探索", icon: "✨" },
    { title: "2. 甘口辛口度", icon: "🍯" },
    { title: "3. 酸度", icon: "🍋" },
    { title: "4. 酒體重量", icon: "⚖️" },
    { title: "5. 酒精衝擊", icon: "🔥" },
    { title: "6. 料理配對", icon: "🥢" },
    { title: "7. 評語 & 意願", icon: "⭐" },
  ];

  function toggle(arr, setter, v) {
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  }

  function canNext() {
    if (step === 0) return aroma.length > 0 || (aromaCustom && aromaCustom.trim());
    if (step === 6) return rating >= 1;
    return true;
  }

  function next() {
    if (!canNext()) return;
    if (step === 6) {
      // 提交
      onSave({
        sakeId: sake.id,
        aroma, aromaCustom,
        sweetness, acidityScore,
        body, alcohol,
        pair, pairCustom,
        note, rating,
        completedAt: new Date().toISOString(),
      });
    } else {
      setStep(s => s + 1);
    }
  }

  return (
    <div className="fade-in px-5 pt-6 pb-12">
      <div className="flex items-center justify-between mb-3">
        <button className="text-muted text-sm" onClick={onCancel}>← 返回</button>
        <span className="text-xs font-bold" style={{ color: timeUp ? "#D85070" : "#B8860B" }}>
          ⏱ {timeUp ? "時間到（仍可填寫）" : `剩餘 ${remain}s`}
        </span>
      </div>

      <div className="text-center mb-2">
        <p className="text-xs text-muted">{sake.name}</p>
        <h2 className="text-xl font-bold">{steps[step].icon} {steps[step].title}</h2>
      </div>

      <div className="progress-pill mb-6">
        {steps.map((_, i) => (
          <span key={i} className={`pill ${i <= step ? "done" : ""}`} />
        ))}
      </div>

      <div className="glass-panel p-5 mb-5 min-h-[280px]">
        {step === 0 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">您聞到了什麼？（複選，至少一項）</p>
            <ChipGroup
              options={AROMA_OPTS}
              selected={aroma}
              onToggle={(v) => toggle(aroma, setAroma, v)}
              custom={aromaCustom}
              setCustom={setAromaCustom}
            />
          </div>
        )}
        {step === 1 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">甘口辛口度？1 = 甘口，5 = 辛口</p>
            <input
              type="range" min="1" max="5" value={sweetness}
              className="sake-range"
              onChange={e => setSweetness(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>甘口</span><b className="text-gold text-xl">{sweetness}</b><span>辛口</span>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">酸度？1 = 柔和，5 = 酸爽</p>
            <input
              type="range" min="1" max="5" value={acidityScore}
              className="sake-range"
              onChange={e => setAcidityScore(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>柔和</span><b className="text-gold text-xl">{acidityScore}</b><span>酸爽</span>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">酒體重量？1 = 極輕盈，5 = 厚重</p>
            <input
              type="range" min="1" max="5" value={body}
              className="sake-range"
              onChange={e => setBody(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>輕</span><b className="text-gold text-xl">{body}</b><span>重</span>
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">酒精衝擊？1 = 溫和，5 = 強烈</p>
            <input
              type="range" min="1" max="5" value={alcohol}
              className="sake-range"
              onChange={e => setAlcohol(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>溫和</span><b className="text-gold text-xl">{alcohol}</b><span>強烈</span>
            </div>
          </div>
        )}
        {step === 5 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">您覺得搭配什麼料理最對味？</p>
            <ChipGroup
              options={PAIR_OPTS}
              selected={pair}
              onToggle={(v) => toggle(pair, setPair, v)}
              custom={pairCustom}
              setCustom={setPairCustom}
            />
          </div>
        )}
        {step === 6 && (
          <div>
            <p className="text-sm text-muted mb-3 text-center">採購意願（1~10 星，至少 1 星）</p>
            <StarRating value={rating} onChange={setRating} />
            <p className="text-center text-gold font-bold mt-2">{rating || "?"} / 10</p>
            <textarea
              className="w-full mt-4 px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm break-word"
              placeholder="一句話評語（選填）"
              rows="3"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <button className="jelly-btn btn-outline flex-1" onClick={() => setStep(s => s - 1)}>← 上一步</button>
        )}
        <button
          className="jelly-btn btn-gold flex-1"
          disabled={!canNext()}
          onClick={next}
        >
          {step === 6 ? "完成評鑑 ✓" : "下一步 →"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   主畫面：Discussion 餐飲場景討論題
   ================================================================ */
function DiscussionScreen({ sake, isLast, onNext, onFinish }) {
  return (
    <div className="fade-in px-5 pt-8 pb-12">
      <div className="text-center mb-6">
        <p className="text-xs text-muted">{sake.name}</p>
        <h2 className="text-2xl font-bold mt-1">💬 場景討論</h2>
      </div>
      <div className="glass-panel p-6 mb-6">
        <p className="text-xs text-gold font-bold tracking-widest mb-3">餐飲場景提問</p>
        <p className="text-base leading-relaxed text-ink break-word italic">
          {sake.discussionPrompt}
        </p>
      </div>
      <p className="text-center text-xs text-muted mb-4">
        ※ 桌上請與夥伴分享您的看法。
      </p>
      <button
        className="jelly-btn btn-gold w-full"
        onClick={() => { playBell(); isLast ? onFinish() : onNext(); }}
      >
        {isLast ? "完成所有酒款 → 採購單" : "下一款酒 →"}
      </button>
    </div>
  );
}

/* ================================================================
   主畫面：Cart 採購單（兩步）
   ================================================================ */
const MOTIVE_OPTS  = ["風味稀有度","價格","在地故事強","季節限定","視覺/包裝佳"];
const STRATEGY_OPTS = ["套餐搭配","單點推薦","常客驚喜","新客入門","活動限定","盲飲挑戰"];

function CartScreen({ sakes, evals, cart, setCart, onSubmit, onBack }) {
  const [step, setStep] = useState(1);
  const [motives, setMotives] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [customMotive, setCustomMotive] = useState("");
  const [customStrategy, setCustomStrategy] = useState("");

  function setQty(id, delta) {
    setCart(prev => {
      const next = { ...prev };
      next[id] = Math.max(0, (next[id] || 0) + delta);
      return next;
    });
  }

  function toggle(arr, setter, v) {
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  }

  function toggleMotive(v) {
    setMotives(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function submitOrder() {
    onSubmit({
      motives,
      strategies,
      ranking: motives,
    });
  }

  const customMotiveOption = customMotive.trim();
  const customStrategyOption = customStrategy.trim();
  const motiveOptions = customMotiveOption && !MOTIVE_OPTS.includes(customMotiveOption)
    ? [...MOTIVE_OPTS, customMotiveOption]
    : MOTIVE_OPTS;
  const strategyOptions = customStrategyOption && !STRATEGY_OPTS.includes(customStrategyOption)
    ? [...STRATEGY_OPTS, customStrategyOption]
    : STRATEGY_OPTS;
  const totalBottles = Object.values(cart).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="fade-in px-5 pt-6 pb-12">
      <div className="flex items-center justify-between mb-3">
        <button className="text-muted text-sm" onClick={onBack}>← 返回</button>
        <span className="text-xs text-gold font-bold tracking-widest">採購決策</span>
      </div>

      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold">🛒 我的採購單</h2>
        <p className="text-xs text-muted mt-1">Step {step} / 2</p>
      </div>

      {step === 1 && (
        <div className="space-y-5 mb-5">
          <div className="glass-panel p-4">
            <p className="text-xs font-bold text-gold tracking-widest mb-3">採購動機（點擊排序）</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {motiveOptions.map(m => (
                <span
                  key={m}
                  className={`motive-order-chip jelly-btn ${motives.includes(m) ? "is-selected" : ""}`}
                  onClick={() => toggleMotive(m)}
                >
                  {motives.includes(m) && <b>{motives.indexOf(m) + 1}</b>}
                  {m}
                </span>
              ))}
            </div>
            {motives.length > 0 && (
              <div className="motive-order-preview mb-3">
                {motives.map((m, i) => (
                  <React.Fragment key={m}>
                    {i > 0 && <span className="motive-order-separator">&gt;</span>}
                    <span>{m}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
            <input
              type="text"
              className="w-full px-4 py-2 rounded-full border border-gray-200 bg-white text-sm"
              placeholder="其他採購動機（填寫後可點擊排序）"
              value={customMotive}
              onChange={e => setCustomMotive(e.target.value)}
            />
          </div>

          <div className="glass-panel p-4">
            <p className="text-xs font-bold text-gold tracking-widest mb-3">運用策略（複選）</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {strategyOptions.map(m => (
                <span
                  key={m}
                  className={`chip jelly-btn ${strategies.includes(m) ? "chip-selected" : ""}`}
                  onClick={() => toggle(strategies, setStrategies, m)}
                >{m}</span>
              ))}
            </div>
            <input
              type="text"
              className="w-full px-4 py-2 rounded-full border border-gray-200 bg-white text-sm"
              placeholder="其他運用策略（填寫後可點擊選取）"
              value={customStrategy}
              onChange={e => setCustomStrategy(e.target.value)}
            />
          </div>

          <button
            className="jelly-btn btn-gold w-full"
            onClick={() => setStep(2)}
          >下一步：選擇瓶數 →</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 mb-5">
          {sakes.map(s => (
            <div key={s.id} className="glass-panel p-3 flex items-center gap-3">
              <img src={s.bottleImage} className="w-12 h-20 object-contain" alt={s.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight break-word">{s.name}</p>
                <p className="text-[10px] text-muted">{s.brewery}</p>
                {evals[s.id]?.rating && (
                  <p className="text-[11px] text-gold">★ {evals[s.id].rating}/10</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="jelly-btn qty-btn qty-btn-minus"
                  onClick={() => setQty(s.id, -1)}
                >−</button>
                <span className="font-bold text-lg w-6 text-center">{cart[s.id] || 0}</span>
                <button
                  className="jelly-btn qty-btn qty-btn-plus"
                  onClick={() => setQty(s.id, 1)}
                >＋</button>
              </div>
            </div>
          ))}
          <div className="text-center text-sm text-muted mb-2">
            共 <b className="text-gold text-lg">{totalBottles}</b> 瓶
          </div>
          <div className="flex gap-3">
            <button
              className="jelly-btn btn-outline flex-1"
              onClick={() => setStep(1)}
            >← 上一步</button>
            <button
              className="jelly-btn btn-gold flex-1"
              onClick={submitOrder}
            >提交採購單 ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   主畫面：LiveWall 統計牆（mock）
   ================================================================ */
function LiveWallScreen({ sakes, onRestart }) {
  // mock 數據
  const mockStats = sakes.map((s, i) => ({
    id: s.id,
    name: s.name,
    avgRating: (6 + Math.sin(i * 1.7) * 1.8 + Math.random() * 1.2).toFixed(1),
    topAroma: s.aromaTags[0],
    bottles: 4 + Math.floor(Math.random() * 12),
  }));

  return (
    <div className="fade-in px-5 pt-6 pb-12">
      <div className="text-center mb-3">
        <span className="mock-tag">📊 示意統計（活動結束後更新）</span>
      </div>
      <h2 className="text-2xl font-bold text-center mb-1">統計牆</h2>
      <p className="text-xs text-muted text-center mb-6">全場 16 位參與者的評鑑彙整（模擬數據）</p>

      <div className="space-y-3">
        {mockStats
          .sort((a, b) => b.avgRating - a.avgRating)
          .map((row, idx) => {
            const sake = sakes.find(x => x.id === row.id);
            const halo = ssiQuadrantKey(sake.ssi);
            return (
              <div key={row.id} className="glass-panel p-4 flex items-center gap-3">
                <span className="text-2xl font-bold text-gold w-8">{idx + 1}</span>
                <img src={sake.bottleImage} className="w-10 h-16 object-contain" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm break-word">{row.name}</p>
                  <p className="text-[11px] text-muted">{row.topAroma} · {sake.ssiQuadrant}</p>
                </div>
                <div className="text-right">
                  <p className="text-gold font-bold text-lg">★ {row.avgRating}</p>
                  <p className="text-[10px] text-muted">{row.bottles} 瓶</p>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-8 space-y-2">
        <button className="jelly-btn btn-gold w-full" onClick={onRestart}>
          🔄 重新開始（清除本機資料）
        </button>
        <p className="text-center text-[11px] text-muted">
          完成時間 · 感謝您今晚的參與
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   App 主控
   ================================================================ */
function App({ data }) {
  // 從 localStorage 還原
  const restored = loadState();
  const [phase, setPhase] = useState(restored?.phase || "intro");
  const [venue, setVenue] = useState(restored?.venue || null);
  const [sakeIdx, setSakeIdx] = useState(restored?.sakeIdx || 0);
  const [opened, setOpened] = useState(false); // 每款酒進入時重置
  const [evals, setEvals] = useState(restored?.evals || {});
  const [cart, setCart] = useState(restored?.cart || {});
  const [showEval, setShowEval] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);

  const sakes = data.sakes;
  const total = sakes.length;
  const currentSake = sakes[sakeIdx];

  // 持久化
  useEffect(() => {
    saveState({ phase, venue, sakeIdx, evals, cart });
  }, [phase, venue, sakeIdx, evals, cart]);

  // 每換一支酒，重設「開瓶 / 評鑑 / 討論」狀態
  useEffect(() => {
    setOpened(false);
    setShowEval(false);
    setShowDiscussion(false);
  }, [sakeIdx]);

  // intro 選店家
  function pickVenue(s) {
    setVenue(s);
    setPhase("stage");
    getAudio(); // 解鎖 audio context
  }

  // 評鑑完成
  function handleSaveEval(rec) {
    setEvals(prev => ({ ...prev, [rec.sakeId]: rec }));
    setShowEval(false);
    setShowDiscussion(true);
  }

  // 下一款酒
  function nextSake() {
    setSakeIdx(i => Math.min(i + 1, total - 1));
  }

  // 全部完成 → cart
  function gotoCart() {
    setPhase("cart");
  }

  // 提交採購單
  function submitCart(extra) {
    const evaluations = Object.values(evals).map(rec => {
      const sake = sakes.find(s => s.id === rec.sakeId) || {};
      return {
        sakeId: rec.sakeId,
        sakeName: sake.name || rec.sakeName || "",
        aromas: rec.aroma || [],
        otherAroma: rec.aromaCustom || "",
        sweetness: rec.sweetness || 0,
        acidityScore: rec.acidityScore || 0,
        body: rec.body || 0,
        alcohol: rec.alcohol || 0,
        pairings: rec.pair || [],
        otherPairing: rec.pairCustom || "",
        comment: rec.note || "",
        intentScore: rec.rating || 0,
        completedAt: rec.completedAt || "",
      };
    });

    const payload = {
      venue,
      completedAt: new Date().toISOString(),
      evaluations,
      cart: sakes.map(s => ({
        sakeId: s.id,
        sakeName: s.name,
        quantity: cart[s.id] || 0,
      })),
      motivations: extra.motives || [],
      recommendStrategies: extra.strategies || [],
      ranking: extra.ranking || extra.motives || [],
    };
    const endpoint = window.SAKE_ORDER_ENDPOINT;
    if (endpoint) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      }).catch(err => console.error("[sake order] post failed", err));
    } else {
      console.log("[sake order] (no endpoint set) payload =", payload);
    }
    playBell();
    setPhase("livewall");
  }

  function restart() {
    if (!confirm("確定要清除本機資料並重新開始？")) return;
    clearState();
    setPhase("intro");
    setVenue(null);
    setSakeIdx(0);
    setEvals({});
    setCart({});
  }

  // 頂部 venue 提示
  const venueBar = venue && phase !== "intro" && (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-100 px-4 py-2 flex items-center justify-between">
      <span className="text-xs text-muted">🏯 {venue}</span>
      <span className="text-[11px] text-gold">{phase === "cart" ? "採購單" : phase === "livewall" ? "統計牆" : `${sakeIdx + 1}/${total}`}</span>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto" style={{ paddingTop: venue && phase !== "intro" ? 36 : 0 }}>
      {venueBar}

      {phase === "intro" && (
        <IntroScreen stores={data.stores} onPick={pickVenue} />
      )}

      {phase === "stage" && !showEval && !showDiscussion && (
        <StageScreen
          key={currentSake.id}
          sake={currentSake}
          index={sakeIdx}
          total={total}
          opened={opened}
          setOpened={setOpened}
          onStartEval={() => setShowEval(true)}
        />
      )}

      {phase === "stage" && showEval && (
        <EvaluationScreen
          key={`eval-${currentSake.id}`}
          sake={currentSake}
          initial={evals[currentSake.id]}
          onSave={handleSaveEval}
          onCancel={() => setShowEval(false)}
        />
      )}

      {phase === "stage" && showDiscussion && (
        <DiscussionScreen
          key={`disc-${currentSake.id}`}
          sake={currentSake}
          isLast={sakeIdx === total - 1}
          onNext={() => { nextSake(); }}
          onFinish={() => { gotoCart(); }}
        />
      )}

      {phase === "cart" && (
        <CartScreen
          sakes={sakes}
          evals={evals}
          cart={cart}
          setCart={setCart}
          onSubmit={submitCart}
          onBack={() => { setPhase("stage"); setSakeIdx(total - 1); setShowDiscussion(true); }}
        />
      )}

      {phase === "livewall" && (
        <LiveWallScreen sakes={sakes} onRestart={restart} />
      )}
    </div>
  );
}

/* ================================================================
   啟動
   ================================================================ */
fetch("./sake_data.json?v=2.3")
  .then(r => r.json())
  .then(data => {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(<App data={data} />);
  })
  .catch(err => {
    document.getElementById("root").innerHTML =
      `<div class="p-6 text-center text-rose-600">資料載入失敗：${err.message}<br>請以 HTTP 伺服器開啟。</div>`;
  });
