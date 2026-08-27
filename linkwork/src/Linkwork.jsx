import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { sweepMech, dist, metrics } from "./lib/solver.js";
import { PRESETS, clone } from "./lib/presets.js";

/* ==========================================================================
   LINKWORK rev 0.1 — general planar kinematic solver for bicycle suspension
   Mechanism = nodes (pivots) + rigid distance constraints (links) + one driver
   (the shock). No layout-specific maths anywhere: single pivot, four-bar,
   Horst, twin-link and six-bar all fall out of the same solver.
   ========================================================================== */

const INK = "#22282E";
const PAPER = "#EDEEE9";
const RULE = "#C3C7BE";
const BLUE = "#2F4BB8";
const BLUE_SOFT = "#9FADE4";
const RED = "#A32E28";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ------------------------------ inverse design ---------------------------- */

function cost(mech, target) {
  const r = sweepMech(mech, 16);
  if (!r.ok) return 1e6;
  const s = r.samples, lr0 = s[1].lr, lr1 = s[s.length - 2].lr;
  const travel = s[s.length - 1].travel;
  if (travel <= 0 || lr0 <= 0) return 1e6;
  let c =
    ((travel - target.travel) / 8) ** 2 +
    ((lr0 - target.lr0) / 0.04) ** 2 +
    ((lr1 - target.lr1) / 0.04) ** 2 +
    ((r.eye - target.eye) / 4) ** 2;
  mech.nodes.forEach((n, i) => {
    const o = target.origin[i];
    c += 0.02 * ((Math.hypot(n.x - o.x, n.y - o.y)) / 30) ** 2;
  });
  return c;
}

/* ------------------------------- geometry view ---------------------------- */

const VIEW = { x0: -845, x1: 195, y0: -400, y1: 480 };
const W = VIEW.x1 - VIEW.x0, H = VIEW.y1 - VIEW.y0;
const toS = (x, y) => [x - VIEW.x0, VIEW.y1 - y];

function Drawing({ mech, sweep, pos, onDrag, onGrab, layoutName }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const cur = sweep.ok ? sweep.samples[Math.min(pos, sweep.samples.length - 1)] : null;
  const P = (i) => (cur ? { x: cur.q[2 * i], y: cur.q[2 * i + 1] } : mech.nodes[i]);

  const toWorld = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return { x: sx + VIEW.x0, y: VIEW.y1 - sy };
  };

  useEffect(() => {
    if (drag === null) return;
    const move = (e) => {
      const p = toWorld(e.touches ? e.touches[0] : e);
      onDrag(drag, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10);
      e.preventDefault();
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag, onDrag]);

  const axle = P(mech.axle);
  const R = 368; // 29in wheel + tyre
  const path = sweep.ok ? sweep.samples.map((s) => toS(s.ax, s.ay).join(",")).join(" ") : "";
  const shockA = P(mech.driver[0]), shockB = P(mech.driver[1]);

  const line = (a, b, w, col, dash) => (
    <line x1={toS(a.x, a.y)[0]} y1={toS(a.x, a.y)[1]} x2={toS(b.x, b.y)[0]} y2={toS(b.x, b.y)[1]}
      stroke={col} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
  );

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", touchAction: "none", background: PAPER }}>
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke={RULE} strokeWidth="1" opacity="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      <rect x="8" y="8" width={W - 16} height={H - 16} fill="none" stroke={INK} strokeWidth="2" />

      {/* ground line */}
      <line x1="20" y1={toS(0, -R + 30)[1]} x2={W - 20} y2={toS(0, -R + 30)[1]} stroke={INK} strokeWidth="1.5" opacity="0.35" />

      {/* wheel */}
      <circle cx={toS(axle.x, axle.y)[0]} cy={toS(axle.x, axle.y)[1]} r={R} fill="none" stroke={INK} strokeWidth="2.5" opacity="0.35" />
      <circle cx={toS(axle.x, axle.y)[0]} cy={toS(axle.x, axle.y)[1]} r={R - 26} fill="none" stroke={INK} strokeWidth="1" opacity="0.2" />

      {/* chain line + chainring */}
      {line({ x: 0, y: 0 }, axle, 1.5, INK, "6 5")}
      <circle cx={toS(0, 0)[0]} cy={toS(0, 0)[1]} r="65" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.45" />
      <circle cx={toS(0, 0)[0]} cy={toS(0, 0)[1]} r="7" fill={INK} />

      {/* axle path */}
      {sweep.ok && <polyline points={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeDasharray="3 6" />}

      {/* links */}
      {mech.links.map(([i, j], k) => <g key={k}>{line(P(i), P(j), 9, INK)}</g>)}

      {/* shock */}
      <g>{line(shockA, shockB, 16, BLUE_SOFT)}{line(shockA, shockB, 4, BLUE)}</g>

      {/* nodes */}
      {mech.nodes.map((n, i) => {
        const p = P(i), [cx, cy] = toS(p.x, p.y);
        const isDragging = drag === i;
        return (
          <g key={i} onPointerDown={(e) => { e.preventDefault(); onGrab(); setDrag(i); }} style={{ cursor: "grab" }}>
            <circle cx={cx} cy={cy} r="26" fill="transparent" />
            {n.fixed
              ? <rect x={cx - 11} y={cy - 11} width="22" height="22" fill={PAPER} stroke={INK} strokeWidth="3.5" />
              : <circle cx={cx} cy={cy} r="11" fill={PAPER} stroke={INK} strokeWidth="3.5" />}
            <circle cx={cx} cy={cy} r="3.5" fill={INK} />
            {isDragging && <circle cx={cx} cy={cy} r="22" fill="none" stroke={BLUE} strokeWidth="2" />}
            <text x={cx + 16} y={cy - 15} fill={INK} fontSize="21" fontFamily={MONO} opacity="0.75">{n.id}</text>
          </g>
        );
      })}

      {/* title block */}
      <g>
        <rect x={W - 318} y={H - 96} width="310" height="88" fill={PAPER} stroke={INK} strokeWidth="2" />
        <line x1={W - 318} y1={H - 62} x2={W - 8} y2={H - 62} stroke={INK} strokeWidth="1" />
        <line x1={W - 150} y1={H - 62} x2={W - 150} y2={H - 8} stroke={INK} strokeWidth="1" />
        <text x={W - 306} y={H - 72} fontSize="22" fontFamily={SANS} fill={INK} letterSpacing="4">LINKWORK · REV 0.1</text>
        <text x={W - 306} y={H - 42} fontSize="16" fontFamily={MONO} fill={INK} opacity="0.55">LAYOUT</text>
        <text x={W - 306} y={H - 20} fontSize="22" fontFamily={MONO} fill={INK}>{layoutName}</text>
        <text x={W - 140} y={H - 42} fontSize="16" fontFamily={MONO} fill={INK} opacity="0.55">TRAVEL</text>
        <text x={W - 140} y={H - 20} fontSize="22" fontFamily={MONO} fill={INK}>
          {sweep.ok ? sweep.samples[sweep.samples.length - 1].travel.toFixed(1) + " mm" : "—"}
        </text>
      </g>
    </svg>
  );
}

/* --------------------------------- chart ---------------------------------- */

function LeverageChart({ sweep }) {
  if (!sweep.ok) return null;
  const s = sweep.samples.slice(1, -1);
  const maxT = s[s.length - 1].travel;
  const lrs = s.map((p) => p.lr);
  const lo = Math.min(...lrs) - 0.15, hi = Math.max(...lrs) + 0.15;
  const w = 600, h = 240, m = { l: 52, r: 14, t: 14, b: 34 };
  const X = (t) => m.l + (t / maxT) * (w - m.l - m.r);
  const Y = (v) => h - m.b - ((v - lo) / (hi - lo)) * (h - m.t - m.b);
  const pts = s.map((p) => `${X(p.travel)},${Y(p.lr)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxT);
  const yt = [lo, (lo + hi) / 2, hi];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }}>
      {yt.map((v, i) => (
        <g key={i}>
          <line x1={m.l} y1={Y(v)} x2={w - m.r} y2={Y(v)} stroke={RULE} strokeWidth="1" />
          <text x={m.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fontFamily={MONO} fill={INK} opacity="0.6">{v.toFixed(2)}</text>
        </g>
      ))}
      {ticks.map((t, i) => (
        <text key={i} x={X(t)} y={h - 12} textAnchor="middle" fontSize="12" fontFamily={MONO} fill={INK} opacity="0.6">{t.toFixed(0)}</text>
      ))}
      <polyline points={pts} fill="none" stroke={BLUE} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------------------------- app ----------------------------------- */

export default function Linkwork() {
  const [layout, setLayout] = useState("Horst link");
  const [mech, setMech] = useState(() => clone(PRESETS["Horst link"]));
  const [pos, setPos] = useState(0);
  const [target, setTarget] = useState({ travel: 160, lr0: 3.0, lr1: 2.35 });
  const [solving, setSolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState(null);

  const sweep = useMemo(() => sweepMech(mech, 60), [mech]);

  const stats = useMemo(() => metrics(sweep), [sweep]);

  const setPreset = (name) => {
    setLayout(name); setMech(clone(PRESETS[name])); setPos(0); setHistory(null);
  };

  const onDrag = useCallback((i, x, y) => {
    setMech((m) => {
      const n = clone(m);
      n.nodes[i].x = x; n.nodes[i].y = y;
      return n;
    });
  }, []);

  // chunked hill-climb so the UI stays responsive
  useEffect(() => {
    if (!solving) return;
    const origin = mech.nodes.map((n) => ({ x: n.x, y: n.y }));
    const tgt = { ...target, eye: dist(mech.nodes[mech.driver[0]], mech.nodes[mech.driver[1]]), origin };
    let best = clone(mech);
    let bc = cost(best, tgt);
    const TOTAL = 3000;
    let i = 0, cancelled = false;
    const step = () => {
      if (cancelled) return;
      const end = Math.min(i + 120, TOTAL);
      for (; i < end; i++) {
        const T = 26 * Math.pow(0.012, i / TOTAL);
        const cand = clone(best);
        const k = Math.floor(Math.random() * cand.nodes.length);
        if (k === cand.axle) continue;
        cand.nodes[k].x += (Math.random() * 2 - 1) * T;
        cand.nodes[k].y += (Math.random() * 2 - 1) * T;
        const c = cost(cand, tgt);
        if (c < bc) { best = cand; bc = c; }
      }
      setProgress(i / TOTAL);
      if (i < TOTAL) setTimeout(step, 0);
      else { setMech(best); setSolving(false); setProgress(0); }
    };
    setTimeout(step, 0);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solving]);

  const startSolve = () => { setHistory(clone(mech)); setSolving(true); };

  const label = { fontFamily: SANS, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: INK, opacity: 0.55 };
  const value = { fontFamily: MONO, fontSize: 19, color: INK };
  const btn = (active) => ({
    fontFamily: SANS, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "9px 13px", border: `1.5px solid ${INK}`, cursor: "pointer",
    background: active ? INK : "transparent", color: active ? PAPER : INK,
  });

  const Stat = ({ k, v }) => (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${RULE}` }}>
      <div style={label}>{k}</div>
      <div style={value}>{v}</div>
    </div>
  );

  const numField = (k, min, max, stepv) => (
    <div style={{ flex: 1 }}>
      <div style={label}>{k === "travel" ? "Travel mm" : k === "lr0" ? "LR at top" : "LR at bottom"}</div>
      <input type="number" value={target[k]} min={min} max={max} step={stepv}
        onChange={(e) => setTarget({ ...target, [k]: parseFloat(e.target.value) || 0 })}
        style={{ width: "100%", marginTop: 4, padding: "7px 8px", fontFamily: MONO, fontSize: 16, color: INK, background: "transparent", border: `1.5px solid ${INK}` }} />
    </div>
  );

  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100%", padding: 16, fontFamily: SANS }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline", marginBottom: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.22em" }}>LINKWORK</div>
          <div style={{ ...label, opacity: 0.5 }}>general planar linkage solver · rev 0.1</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {Object.keys(PRESETS).map((k) => (
            <button key={k} onClick={() => setPreset(k)} style={btn(k === layout)}>{k}</button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0,1fr)" }}>
          <div style={{ border: `2px solid ${INK}` }}>
            <Drawing mech={mech} sweep={sweep} pos={pos} onDrag={onDrag} onGrab={() => setPos(0)} layoutName={layout.toUpperCase()} />
          </div>

          {!sweep.ok && (
            <div style={{ border: `2px solid ${RED}`, padding: 12, color: RED, fontFamily: MONO, fontSize: 14 }}>
              {sweep.reason} — at {sweep.at?.toFixed(1)} mm of shock stroke. Drag a pivot back into a workable position.
            </div>
          )}

          <div>
            <div style={label}>Shock stroke · {sweep.ok ? sweep.samples[Math.min(pos, sweep.samples.length - 1)].stroke.toFixed(1) : "—"} mm of {mech.stroke}</div>
            <input type="range" min={0} max={60} value={pos} onChange={(e) => setPos(+e.target.value)}
              style={{ width: "100%", marginTop: 8, accentColor: BLUE }} />
          </div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div>
              <div style={{ ...label, marginBottom: 6 }}>Leverage ratio vs wheel travel</div>
              <div style={{ border: `1.5px solid ${INK}`, padding: 6 }}>
                <LeverageChart sweep={sweep} />
              </div>
            </div>

            <div>
              {stats && <>
                <Stat k="Wheel travel" v={`${stats.travel.toFixed(1)} mm`} />
                <Stat k="Shock" v={`${stats.eye.toFixed(1)} × ${mech.stroke} mm`} />
                <Stat k="Leverage top → bottom" v={`${stats.lr0.toFixed(2)} → ${stats.lr1.toFixed(2)}`} />
                <Stat k="Progression" v={`${stats.progression.toFixed(1)} %`} />
                <Stat k="Axle path at bottom out" v={`${stats.axleShift > 0 ? "+" : ""}${stats.axleShift.toFixed(1)} mm ${stats.axleShift > 0 ? "rearward" : "forward"}`} />
                <Stat k="Chain growth · kickback" v={`${stats.chainGrowth.toFixed(1)} mm · ${stats.pedalKickback.toFixed(1)}°`} />
              </>}
            </div>
          </div>

          <div style={{ border: `2px solid ${INK}`, padding: 14 }}>
            <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.16em", marginBottom: 10 }}>INVERSE DESIGN</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              {numField("travel", 80, 220, 5)}
              {numField("lr0", 1.5, 4, 0.05)}
              {numField("lr1", 1.5, 4, 0.05)}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={startSolve} disabled={solving} style={{ ...btn(true), opacity: solving ? 0.5 : 1 }}>
                {solving ? `Solving ${(progress * 100).toFixed(0)}%` : "Solve pivot positions"}
              </button>
              {history && !solving && (
                <button onClick={() => { setMech(history); setHistory(null); }} style={btn(false)}>Undo solve</button>
              )}
              <div style={{ ...label, opacity: 0.5 }}>keeps eye-to-eye and stays near the current shape</div>
            </div>
          </div>

          <div style={{ ...label, opacity: 0.45, lineHeight: 1.7 }}>
            Squares are pivots grounded to the front triangle, circles move. Drag any of them. Chain growth uses a
            straight-line chain on a 30t cog. Anti-squat and anti-rise are not modelled yet.
          </div>
        </div>
      </div>
    </div>
  );
}
