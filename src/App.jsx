src/CALMO_App.jsx
import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE = "calmo-v8";
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; } };
const save = (d) => { try { localStorage.setItem(STORAGE, JSON.stringify(d)); } catch {} };

const DARK  = { bg: "#14130F", surface: "#1c1a16", border: "#2a2720", text: "#f0ead8", sub: "#5a5448", placeholder: "#2e2c28" };
const LIGHT = { bg: "#F4EFE6", surface: "#EAE5DA", border: "#D5CFC2", text: "#14130F", sub: "#8a8070", placeholder: "#C0BAB0" };

const FONTS = [
  { id: "serif",   family: "'Georgia', serif" },
  { id: "black",   family: "'Arial Black', sans-serif" },
  { id: "classic", family: "'Palatino', serif" },
  { id: "modern",  family: "'Trebuchet MS', sans-serif" },
  { id: "mono",    family: "'Courier New', monospace" },
];

const SECTIONS = ["oggi", "lavoro", "personale", "calendario"];
const MONTHS   = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const WDAYS    = ["Lu","Ma","Me","Gi","Ve","Sa","Do"];
const todayISO = () => new Date().toISOString().split("T")[0];
const todayFmt = () => new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

// ── Detect mobile ─────────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth < 768;

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [db, setDb] = useState(() => {
    const d = load();
    return {
      tasks:    d.tasks    || {},
      clients:  d.clients  || [],
      theme:    d.theme    || "dark",
      fontId:   d.fontId   || "serif",
      fontSize: d.fontSize || 17,
    };
  });

  const [sectionIdx,  setSectionIdx]  = useState(0);   // 0=oggi 1=lavoro 2=personale 3=calendario
  const [clientIdx,   setClientIdx]   = useState(0);   // index within lavoro clients
  const [intro,       setIntro]       = useState(true); // show intro animation
  const [introSmall,  setIntroSmall]  = useState(false);
  const [showSettings,setShowSettings]= useState(false);
  const [expandTask,  setExpandTask]  = useState(null);
  const [addingClient,setAddingClient]= useState(false);
  const [newClient,   setNewClient]   = useState("");
  const [selDay,      setSelDay]      = useState(todayISO());
  const [calDate,     setCalDate]     = useState(new Date());
  const [mobile,      setMobile]      = useState(isMobile());

  const T    = db.theme === "light" ? LIGHT : DARK;
  const font = FONTS.find(f => f.id === db.fontId)?.family || FONTS[0].family;

  useEffect(() => { save(db); }, [db]);
  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Intro sequence
  useEffect(() => {
    const t1 = setTimeout(() => setIntroSmall(true), 1200);
    const t2 = setTimeout(() => setIntro(false), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────
  const patch     = (k, v) => setDb(p => ({ ...p, [k]: v }));
  const patchT    = (k, fn) => setDb(p => ({ ...p, tasks: { ...p.tasks, [k]: fn(p.tasks[k] || []) } }));
  const addTask   = (k, text, client) => { const t = text.trim(); if (!t) return; patchT(k, l => [...l, { id: Date.now(), text: t, done: false, client, reminder: "" }]); };
  const toggle    = (k, id) => patchT(k, l => l.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const delTask   = (k, id) => { patchT(k, l => l.filter(t => t.id !== id)); if (expandTask === id) setExpandTask(null); };
  const setRem    = (k, id, v) => patchT(k, l => l.map(t => t.id === id ? { ...t, reminder: v } : t));
  const addClient = () => {
    const n = newClient.trim();
    if (!n || db.clients.includes(n)) return;
    patch("clients", [...db.clients, n]);
    setNewClient(""); setAddingClient(false);
  };
  const delClient = (name) => {
    patch("clients", db.clients.filter(c => c !== name));
    patchT("lavoro", l => l.filter(t => t.client !== name));
    if (clientIdx >= db.clients.length - 1) setClientIdx(Math.max(0, clientIdx - 1));
  };

  // ── Section progress ──────────────────────────────────────────────────
  const pct = (key) => {
    const all = db.tasks[key] || [];
    if (!all.length) return null;
    return Math.round(all.filter(t => t.done).length / all.length * 100);
  };

  const section = SECTIONS[sectionIdx];

  // ── Swipe navigation (vertical = sections, horiz inside lavoro = clients) ──
  const swipeRef   = useRef(null);
  const swipeStart = useRef(null);

  const handleSwipeStart = useCallback((e) => {
    const t = e.touches?.[0] || e;
    swipeStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleSwipeEnd = useCallback((e) => {
    if (!swipeStart.current) return;
    const t = e.changedTouches?.[0] || e;
    const dx = t.clientX - swipeStart.current.x;
    const dy = t.clientY - swipeStart.current.y;
    swipeStart.current = null;

    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX < 30 && absY < 30) return;

    if (absY > absX) {
      // Vertical — change section
      if (dy < -40) setSectionIdx(i => Math.min(SECTIONS.length - 1, i + 1));
      if (dy >  40) setSectionIdx(i => Math.max(0, i - 1));
    } else {
      // Horizontal — change client inside lavoro
      if (section === "lavoro" && db.clients.length > 1) {
        if (dx < -40) setClientIdx(i => Math.min(db.clients.length - 1, i + 1));
        if (dx >  40) setClientIdx(i => Math.max(0, i - 1));
      }
    }
  }, [section, db.clients.length]);

  // ── Calendar ──────────────────────────────────────────────────────────
  const yr = calDate.getFullYear(), mo = calDate.getMonth();
  const offset = (new Date(yr, mo, 1).getDay() + 6) % 7;
  const dim    = new Date(yr, mo + 1, 0).getDate();
  const cells  = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const dayKey = d => `${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const today  = todayISO();

  // ── Render helpers ────────────────────────────────────────────────────
  const meta = { fontSize: 10, color: T.sub, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, fontFamily: "'Helvetica Neue', sans-serif" };

  const ProgressBar = ({ k }) => {
    const p = pct(k);
    if (p === null) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 2, background: T.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: p + "%", background: T.text, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
        <span style={{ ...meta, fontSize: 11, color: T.sub, minWidth: 32, textAlign: "right" }}>{p}%</span>
      </div>
    );
  };

  // ── MOBILE layout — full-page swipeable ───────────────────────────────
  if (mobile) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: T.bg, overflow: "hidden", position: "relative", fontFamily: "'Helvetica Neue', sans-serif" }}>

        {/* Intro animation */}
        {intro && (
          <div style={{ position: "absolute", inset: 0, zIndex: 200, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.4s ease", opacity: introSmall ? 0 : 1, pointerEvents: "none" }}>
            <h1 style={{ fontFamily: "'Arial Black', sans-serif", fontSize: introSmall ? 18 : 64, color: T.text, letterSpacing: introSmall ? "0.1em" : "-2px", transition: "all 0.5s cubic-bezier(0.4,0,0.2,1)" }}>CALMO</h1>
          </div>
        )}

        {/* Fixed top bar — minimal */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, padding: "48px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <p style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 13, color: T.text, letterSpacing: "0.06em" }}>{SECTIONS[sectionIdx].toUpperCase()}</p>
              {pct(SECTIONS[sectionIdx]) !== null && (
                <span style={{ fontSize: 10, color: T.sub, fontFamily: "'Helvetica Neue', sans-serif" }}>{pct(SECTIONS[sectionIdx])}%</span>
              )}
            </div>
            {pct(SECTIONS[sectionIdx]) !== null && (
              <div style={{ width: 120, height: 2, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: pct(SECTIONS[sectionIdx]) + "%", background: T.text, borderRadius: 2, transition: "width 0.5s ease" }} />
              </div>
            )}
          </div>
          <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        {/* Section indicator dots (right side) */}
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 100, display: "flex", flexDirection: "column", gap: 6 }}>
          {SECTIONS.map((s, i) => (
            <div key={s} onClick={() => setSectionIdx(i)} style={{ width: 4, height: i === sectionIdx ? 20 : 4, borderRadius: 2, background: i === sectionIdx ? T.text : T.border, transition: "all 0.3s ease", cursor: "pointer" }} />
          ))}
        </div>

        {/* Swipeable page area */}
        <div ref={swipeRef} style={{ position: "absolute", inset: 0, overflowY: "hidden" }}
          onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}
          onMouseDown={handleSwipeStart} onMouseUp={handleSwipeEnd}>

          {/* Pages shifted by sectionIdx */}
          <div style={{ position: "absolute", inset: 0, transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)", transform: "translateY(" + (-sectionIdx * 100) + "%)" }}>

            {/* ── OGGI ── */}
            <PageOggi db={db} T={T} font={font} meta={meta} pct={pct} ProgressBar={ProgressBar}
              addTask={addTask} toggle={toggle} delTask={delTask} setRem={setRem}
              expandTask={expandTask} setExpandTask={setExpandTask} />

            {/* ── LAVORO ── */}
            <PageLavoro db={db} T={T} font={font} meta={meta} pct={pct} ProgressBar={ProgressBar}
              clientIdx={clientIdx} setClientIdx={setClientIdx}
              addTask={addTask} toggle={toggle} delTask={delTask} setRem={setRem}
              expandTask={expandTask} setExpandTask={setExpandTask}
              addingClient={addingClient} setAddingClient={setAddingClient}
              newClient={newClient} setNewClient={setNewClient}
              addClient={addClient} delClient={delClient} />

            {/* ── PERSONALE ── */}
            <PagePersonale db={db} T={T} font={font} meta={meta} pct={pct} ProgressBar={ProgressBar}
              addTask={addTask} toggle={toggle} delTask={delTask} setRem={setRem}
              expandTask={expandTask} setExpandTask={setExpandTask} />

            {/* ── CALENDARIO ── */}
            <PageCalendario db={db} T={T} font={font} meta={meta}
              selDay={selDay} setSelDay={setSelDay}
              calDate={calDate} setCalDate={setCalDate}
              yr={yr} mo={mo} cells={cells} dayKey={dayKey} today={today}
              addTask={addTask} toggle={toggle} delTask={delTask} setRem={setRem}
              expandTask={expandTask} setExpandTask={setExpandTask} />
          </div>
        </div>

        {/* Settings */}
        {showSettings && <Settings db={db} patch={patch} T={T} FONTS={FONTS} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ── DESKTOP layout — cards side by side ───────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Helvetica Neue', sans-serif" }}>
      {/* Top bar */}
      <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <h1 style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 28, color: T.text, letterSpacing: "-0.5px" }}>CALMO</h1>
          <p style={{ ...meta }}>{todayFmt()}</p>
        </div>
        <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "1px solid " + T.border, borderRadius: 10, padding: "8px 10px", cursor: "pointer", color: T.sub }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, height: "calc(100vh - 73px)", background: T.border }}>
        {/* Oggi */}
        <div style={{ background: T.bg, overflow: "auto", padding: "28px 24px" }}>
          <DesktopSectionHeader title="Oggi" pct={pct("oggi")} T={T} meta={meta} ProgressBar={ProgressBar} pctKey="oggi" />
          <TaskSheet taskKey="oggi" tasks={db.tasks["oggi"] || []} T={T} font={font} fontSize={db.fontSize}
            onAdd={t => addTask("oggi", t)} onToggle={id => toggle("oggi", id)} onDel={id => delTask("oggi", id)}
            onRem={(id, v) => setRem("oggi", id, v)} expandTask={expandTask} setExpandTask={setExpandTask} />
        </div>

        {/* Lavoro */}
        <div style={{ background: T.bg, overflow: "auto", padding: "28px 24px" }}>
          <DesktopSectionHeader title="Lavoro" pct={pct("lavoro")} T={T} meta={meta} ProgressBar={ProgressBar} pctKey="lavoro" />
          {db.clients.length === 0 && !addingClient && <p style={{ ...meta, marginBottom: 16 }}>Nessun cliente</p>}
          {db.clients.map(client => {
            const ct = (db.tasks["lavoro"] || []).filter(t => t.client === client);
            return (
              <div key={client} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <p style={{ ...meta, flex: 1 }}>{client}</p>
                  <button onClick={() => delClient(client)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 14 }}>×</button>
                </div>
                <TaskSheet taskKey="lavoro" tasks={ct} T={T} font={font} fontSize={db.fontSize}
                  onAdd={t => addTask("lavoro", t, client)} onToggle={id => toggle("lavoro", id)} onDel={id => delTask("lavoro", id)}
                  onRem={(id, v) => setRem("lavoro", id, v)} expandTask={expandTask} setExpandTask={setExpandTask} compact />
              </div>
            );
          })}
          {addingClient ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={newClient} onChange={e => setNewClient(e.target.value)} onKeyDown={e => e.key === "Enter" && addClient()}
                placeholder="Cliente…" autoFocus
                style={{ flex: 1, background: T.surface, border: "1px solid " + T.border, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: T.text, outline: "none" }} />
              <button onClick={addClient} style={{ background: T.text, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: T.bg, fontWeight: 700 }}>OK</button>
              <button onClick={() => setAddingClient(false)} style={{ background: T.surface, border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", color: T.sub }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAddingClient(true)} style={{ background: "none", border: "1px dashed " + T.border, borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: T.sub, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: T.text, fontSize: 16 }}>+</span> Nuovo cliente
            </button>
          )}
        </div>

        {/* Personale */}
        <div style={{ background: T.bg, overflow: "auto", padding: "28px 24px" }}>
          <DesktopSectionHeader title="Personale" pct={pct("personale")} T={T} meta={meta} ProgressBar={ProgressBar} pctKey="personale" />
          <TaskSheet taskKey="personale" tasks={db.tasks["personale"] || []} T={T} font={font} fontSize={db.fontSize}
            onAdd={t => addTask("personale", t)} onToggle={id => toggle("personale", id)} onDel={id => delTask("personale", id)}
            onRem={(id, v) => setRem("personale", id, v)} expandTask={expandTask} setExpandTask={setExpandTask} />
        </div>

        {/* Calendario */}
        <div style={{ background: T.bg, overflow: "auto", padding: "28px 24px" }}>
          <DesktopSectionHeader title="Calendario" T={T} meta={meta} />
          <PageCalendario db={db} T={T} font={font} meta={meta}
            selDay={selDay} setSelDay={setSelDay}
            calDate={calDate} setCalDate={setCalDate}
            yr={yr} mo={mo} cells={cells} dayKey={dayKey} today={today}
            addTask={addTask} toggle={toggle} delTask={delTask} setRem={setRem}
            expandTask={expandTask} setExpandTask={setExpandTask} desktop />
        </div>
      </div>

      {showSettings && <Settings db={db} patch={patch} T={T} FONTS={FONTS} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── Page components (mobile full-screen) ──────────────────────────────────────

function PageOggi({ db, T, font, meta, ProgressBar, addTask, toggle, delTask, setRem, expandTask, setExpandTask }) {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "auto", padding: "88px 20px 24px", background: T.bg }}>
      <TaskSheet taskKey="oggi" tasks={db.tasks["oggi"] || []} T={T} font={font} fontSize={db.fontSize || 17}
        onAdd={t => addTask("oggi", t)} onToggle={id => toggle("oggi", id)} onDel={id => delTask("oggi", id)}
        onRem={(id, v) => setRem("oggi", id, v)} expandTask={expandTask} setExpandTask={setExpandTask} />
    </div>
  );
}

function PageLavoro({ db, T, font, meta, ProgressBar, clientIdx, setClientIdx, addTask, toggle, delTask, setRem, expandTask, setExpandTask, addingClient, setAddingClient, newClient, setNewClient, addClient, delClient }) {
  const clients = db.clients || [];
  const client  = clients[clientIdx] || null;
  const tasks   = client ? (db.tasks["lavoro"] || []).filter(t => t.client === client) : [];

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "auto", padding: "88px 20px 24px", background: T.bg }}>

      {clients.length === 0 && !addingClient && (
        <p style={{ ...meta, marginBottom: 20 }}>Nessun cliente — aggiungine uno</p>
      )}

      {clients.length > 0 && (
        <>
          {/* Client tabs — horizontal scroll */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {clients.map((c, i) => (
              <button key={c} onClick={() => setClientIdx(i)}
                style={{ flexShrink: 0, background: i === clientIdx ? T.text : T.surface, border: "none", borderRadius: 20, padding: "6px 16px", cursor: "pointer", color: i === clientIdx ? T.bg : T.sub, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Helvetica Neue', sans-serif" }}>
                {c}
              </button>
            ))}
          </div>

          {/* Client header - minimal */}
          {client && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ ...meta }}>{client}</p>
              <button onClick={() => delClient(client)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 16, padding: "0 4px" }}>×</button>
            </div>
          )}

          {client && (
            <TaskSheet taskKey="lavoro" tasks={tasks} T={T} font={font} fontSize={db.fontSize || 17}
              onAdd={t => addTask("lavoro", t, client)} onToggle={id => toggle("lavoro", id)} onDel={id => delTask("lavoro", id)}
              onRem={(id, v) => setRem("lavoro", id, v)} expandTask={expandTask} setExpandTask={setExpandTask} />
          )}

          {/* Swipe hint */}
          {clients.length > 1 && (
            <p style={{ ...meta, textAlign: "center", marginTop: 24, opacity: 0.4 }}>← swipe per cambiare cliente →</p>
          )}
        </>
      )}

      {/* Add client */}
      <div style={{ marginTop: 20 }}>
        {addingClient ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newClient} onChange={e => setNewClient(e.target.value)} onKeyDown={e => e.key === "Enter" && addClient()}
              placeholder="Nome cliente…" autoFocus
              style={{ flex: 1, background: T.surface, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: T.text, outline: "none" }} />
            <button onClick={addClient} style={{ background: T.text, border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: T.bg, fontWeight: 700 }}>OK</button>
            <button onClick={() => setAddingClient(false)} style={{ background: T.surface, border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: T.sub }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAddingClient(true)}
            style={{ background: "none", border: "1px dashed " + T.border, borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: T.sub, fontSize: 13, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Helvetica Neue', sans-serif" }}>
            <span style={{ color: T.text, fontSize: 18 }}>+</span> Nuovo cliente
          </button>
        )}
      </div>
    </div>
  );
}

function PagePersonale({ db, T, font, meta, ProgressBar, addTask, toggle, delTask, setRem, expandTask, setExpandTask }) {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "auto", padding: "88px 20px 24px", background: T.bg }}>
      <TaskSheet taskKey="personale" tasks={db.tasks["personale"] || []} T={T} font={font} fontSize={db.fontSize || 17}
        onAdd={t => addTask("personale", t)} onToggle={id => toggle("personale", id)} onDel={id => delTask("personale", id)}
        onRem={(id, v) => setRem("personale", id, v)} expandTask={expandTask} setExpandTask={setExpandTask} />
    </div>
  );
}

function PageCalendario({ db, T, font, meta, selDay, setSelDay, calDate, setCalDate, yr, mo, cells, dayKey, today, addTask, toggle, delTask, setRem, expandTask, setExpandTask, desktop }) {
  const [calSec, setCalSec] = useState("oggi");
  const calKey = calSec === "oggi" ? selDay : calSec + "_cal_" + selDay;

  return (
    <div style={{ width: desktop ? "100%" : "100vw", height: desktop ? "auto" : "100vh", overflow: "auto", padding: desktop ? 0 : "88px 20px 24px", background: T.bg }}>
      {!desktop && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 18, color: T.text, letterSpacing: "-0.5px" }}>Calendario</h2>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => setCalDate(new Date(yr, mo - 1, 1))} style={{ background: T.surface, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.sub, fontSize: 16 }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 16, color: T.text, letterSpacing: "0.02em" }}>{MONTHS[mo].toUpperCase()}</p>
          <p style={{ ...meta, fontSize: 9 }}>{yr}</p>
        </div>
        <button onClick={() => setCalDate(new Date(yr, mo + 1, 1))} style={{ background: T.surface, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.sub, fontSize: 16 }}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 16 }}>
        {WDAYS.map(d => <div key={d} style={{ textAlign: "center", ...meta, fontSize: 8, padding: "3px 0" }}>{d}</div>)}
        {cells.map((d, i) => {
          const k = d ? dayKey(d) : null;
          const isSel = k === selDay, isT = k === today;
          return (
            <button key={i} onClick={() => d && setSelDay(k)} disabled={!d}
              style={{ background: isSel ? T.text : isT ? T.surface : "transparent", border: "none", borderRadius: 7, height: 32, fontSize: 12, cursor: d ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: isSel ? T.bg : isT ? T.text : d ? T.sub : "transparent", fontWeight: (isSel || isT) ? 700 : 400 }}>
              {d || ""}
            </button>
          );
        })}
      </div>

      <p style={{ ...meta, color: T.sub, marginBottom: 12 }}>
        {new Date(selDay + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["oggi", "Giornata"], ["lavoro", "Lavoro"], ["personale", "Personale"]].map(([k, label]) => (
          <button key={k} onClick={() => setCalSec(k)}
            style={{ flex: 1, background: calSec === k ? T.text : "transparent", border: "1px solid " + (calSec === k ? T.text : T.border), borderRadius: 8, padding: "6px 0", cursor: "pointer", color: calSec === k ? T.bg : T.sub, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Helvetica Neue', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      <TaskSheet taskKey={calKey} tasks={db.tasks[calKey] || []} T={T} font={font} fontSize={db.fontSize || 17}
        onAdd={t => addTask(calKey, t)} onToggle={id => toggle(calKey, id)} onDel={id => delTask(calKey, id)}
        onRem={(id, v) => setRem(calKey, id, v)} expandTask={expandTask} setExpandTask={setExpandTask} />
    </div>
  );
}

// ── Desktop section header ────────────────────────────────────────────────────
function DesktopSectionHeader({ title, T, meta, ProgressBar, pctKey }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 22, color: T.text, letterSpacing: "-0.5px", marginBottom: 10 }}>{title}</h2>
      {ProgressBar && pctKey && <ProgressBar k={pctKey} />}
    </div>
  );
}

// ── TaskSheet ─────────────────────────────────────────────────────────────────
function TaskSheet({ taskKey, tasks, T, font, fontSize, onAdd, onToggle, onDel, onRem, expandTask, setExpandTask, compact }) {
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  const now = Date.now();
  const empty = Math.max(0, 4 - tasks.length);

  return (
    <div style={{ marginBottom: 8 }}>
      {tasks.map(task => {
        const isExp   = expandTask === task.id;
        const overdue = task.reminder && !task.done && new Date(task.reminder).getTime() < now;
        return (
          <SwipeRow key={task.id} onDelete={() => onDel(task.id)} T={T}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: (compact ? "10px 0" : "13px 0"), borderBottom: "1px solid " + T.border, background: "transparent", cursor: "pointer", minHeight: 46 }}
                onClick={() => onToggle(task.id)}>
                <span style={{ fontFamily: font, fontSize, lineHeight: 1.4, flex: 1, color: task.done ? T.sub : T.text, textDecoration: task.done ? "line-through" : "none", textDecorationColor: T.sub, opacity: task.done ? 0.4 : 1, userSelect: "none", wordBreak: "break-word" }}>
                  {task.text}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  {task.reminder && (
                    <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, border: "1px solid " + (overdue ? "#C0392B" : T.border), color: overdue ? "#C0392B" : T.sub, textTransform: "uppercase" }}>
                      🕐 {new Date(task.reminder).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <button onClick={e => { e.stopPropagation(); setExpandTask(isExp ? null : task.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: isExp ? T.text : T.sub, padding: 4, display: "flex", opacity: 0.6 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </button>
                </div>
              </div>
              {isExp && (
                <div style={{ borderTop: "1px solid " + T.border, background: T.bg, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  <span style={{ fontSize: 9, color: T.sub, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>Reminder</span>
                  <input type="datetime-local" value={task.reminder || ""}
                    onChange={e => onRem(task.id, e.target.value)}
                    style={{ background: T.surface, border: "1px solid " + T.border, color: T.text, borderRadius: 7, padding: "4px 8px", fontSize: 11, outline: "none" }} />
                  {task.reminder && <button onClick={() => onRem(task.id, "")} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 13 }}>✕</button>}
                </div>
              )}
            </div>
          </SwipeRow>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: compact ? "10px 0" : "13px 0", borderBottom: "1px solid " + T.border, cursor: "text" }} onClick={() => ref.current?.focus()}>
        <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { onAdd(draft); setDraft(""); } }}
          placeholder={tasks.length === 0 ? "aggiungi…" : "+"}
          style={{ background: "transparent", border: "none", outline: "none", flex: 1, fontFamily: font, fontSize: Math.max(12, fontSize - 3), color: T.placeholder }} />
      </div>

    </div>
  );
}

// ── LongPressRow — hold to delete ────────────────────────────────────────────
function SwipeRow({ children, onDelete, T }) {
  const timer   = useRef(null);
  const moved   = useRef(false);

  const start = e => {
    moved.current = false;
    timer.current = setTimeout(() => {
      if (!moved.current && window.confirm("Eliminare questo task?")) {
        onDelete();
      }
    }, 500);
  };

  const cancel = () => {
    clearTimeout(timer.current);
  };

  const onMove = () => {
    moved.current = true;
    clearTimeout(timer.current);
  };

  return (
    <div
      onMouseDown={start} onMouseUp={cancel} onMouseLeave={cancel} onMouseMove={onMove}
      onTouchStart={start} onTouchEnd={cancel} onTouchMove={onMove}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}>
      {children}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings({ db, patch, T, FONTS, onClose }) {
  const meta = { fontSize: 10, color: T.sub, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, fontFamily: "'Helvetica Neue', sans-serif" };
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.surface, borderRadius: "20px 20px 0 0", padding: "24px 24px 52px", width: "100%", maxWidth: 560 }}>
        <div style={{ width: 36, height: 3, background: T.border, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 20, color: T.text }}>IMPOSTAZIONI</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 22 }}>✕</button>
        </div>

        <p style={{ ...meta, marginBottom: 10 }}>Tema</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["dark", "light"].map(t => (
            <button key={t} onClick={() => patch("theme", t)}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid " + (db.theme === t ? T.text : T.border), background: db.theme === t ? T.text : "transparent", color: db.theme === t ? T.bg : T.sub, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Helvetica Neue', sans-serif" }}>
              {t === "dark" ? "🌑 Scuro" : "☀️ Chiaro"}
            </button>
          ))}
        </div>

        <p style={{ ...meta, marginBottom: 10 }}>Font</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {FONTS.map(f => (
            <button key={f.id} onClick={() => patch("fontId", f.id)}
              style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid " + (db.fontId === f.id ? T.text : T.border), background: db.fontId === f.id ? T.text : "transparent", color: db.fontId === f.id ? T.bg : T.sub, cursor: "pointer", fontSize: 14, fontFamily: f.family }}>
              {f.id === "serif" ? "Georgia" : f.id === "black" ? "Arial Black" : f.id === "classic" ? "Palatino" : f.id === "modern" ? "Modern" : "Mono"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={meta}>Dimensione</p>
          <span style={{ fontSize: 13, color: T.text, fontFamily: "monospace" }}>{db.fontSize}px</span>
        </div>
        <input type="range" min="13" max="44" value={db.fontSize} onChange={e => patch("fontSize", Number(e.target.value))}
          style={{ width: "100%", accentColor: T.text }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: T.sub }}>Piccolo</span>
          <span style={{ fontSize: 10, color: T.sub }}>Grande</span>
        </div>
      </div>
    </div>
  );
}
