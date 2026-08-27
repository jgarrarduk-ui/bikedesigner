/**
 * Linkwork kinematic core.
 *
 * A mechanism is a graph, not a layout. Nodes are pivots, links are rigid
 * distance constraints, one driver (the shock) removes the last degree of
 * freedom. Single pivot, four-bar, Horst, twin-link, six-bar and idler
 * routings are all the same code with a different graph.
 *
 * INVARIANT: the system must be square. For N nodes there are 2N unknowns and
 * the constraint count must equal 2N:
 *     2 * (fixed nodes) + (links) + 1 driver === 2N
 * A rigid body spanning k nodes contributes 2k-3 independent links, so
 * triangulate it (Laman graph) rather than adding every possible edge.
 * Anything else is a modelling error, and the solver says so.
 */

/** Gauss-Jordan with partial pivoting. Returns null if singular. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    const t = M[c]; M[c] = M[p]; M[p] = t;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Residual vector and its Jacobian at coordinate vector q. */
export function residuals(q, mech, rest, driveLen) {
  const n = q.length / 2;
  const r = [], rows = [];
  const zero = () => new Float64Array(2 * n);

  mech.nodes.forEach((nd, i) => {
    if (!nd.fixed) return;
    let g = zero(); g[2 * i] = 1; r.push(q[2 * i] - nd.x); rows.push(g);
    g = zero(); g[2 * i + 1] = 1; r.push(q[2 * i + 1] - nd.y); rows.push(g);
  });

  const dres = (i, j, len) => {
    const dx = q[2 * i] - q[2 * j], dy = q[2 * i + 1] - q[2 * j + 1];
    const g = zero();
    g[2 * i] = 2 * dx; g[2 * i + 1] = 2 * dy;
    g[2 * j] = -2 * dx; g[2 * j + 1] = -2 * dy;
    r.push(dx * dx + dy * dy - len * len); rows.push(g);
  };

  mech.links.forEach(([i, j], k) => dres(i, j, rest[k]));
  dres(mech.driver[0], mech.driver[1], driveLen);
  return { r, rows };
}

const norm = (v) => { let m = 0; for (const x of v) m = Math.max(m, Math.abs(x)); return m; };

/**
 * Newton-Raphson with backtracking line search. Warm start from the previous
 * stroke position: without it the solver picks the wrong assembly branch and
 * the linkage flips inside out mid sweep.
 */
export function solveAt(q0, mech, rest, driveLen) {
  let q = Float64Array.from(q0);
  for (let it = 0; it < 40; it++) {
    const { r, rows } = residuals(q, mech, rest, driveLen);
    const err = norm(r);
    if (err < 1e-8) return { q, ok: true, iterations: it };
    if (r.length !== q.length) {
      return { ok: false, reason: `not 1-DOF: ${r.length} constraints for ${q.length} coordinates` };
    }
    const dq = solveLinear(rows.map((row) => Array.from(row)), r.map((v) => -v));
    if (!dq || dq.some((v) => !isFinite(v))) return { ok: false, reason: "singular Jacobian — pivots collinear?" };
    let step = 1, accepted = false;
    for (let t = 0; t < 24; t++) {
      const trial = Float64Array.from(q);
      for (let i = 0; i < trial.length; i++) trial[i] += step * dq[i];
      if (norm(residuals(trial, mech, rest, driveLen).r) < err) { q = trial; accepted = true; break; }
      step *= 0.5;
    }
    if (!accepted) return { ok: false, reason: "linkage binds — mechanism limit reached" };
  }
  return { ok: false, reason: "no convergence" };
}

export function restLengths(mech) {
  return mech.links.map(([i, j]) => dist(mech.nodes[i], mech.nodes[j]));
}

/**
 * Sweep the shock through its stroke. Returns samples carrying the full
 * coordinate vector, so downstream metrics (velocities, instant centres,
 * anti-squat) can be derived without re-solving.
 */
export function sweepMech(mech, steps = 60) {
  const rest = restLengths(mech);
  const eye = dist(mech.nodes[mech.driver[0]], mech.nodes[mech.driver[1]]);
  let q = new Float64Array(mech.nodes.length * 2);
  mech.nodes.forEach((n, i) => { q[2 * i] = n.x; q[2 * i + 1] = n.y; });

  const samples = [];
  for (let s = 0; s <= steps; s++) {
    const stroke = (mech.stroke * s) / steps;
    const res = solveAt(q, mech, rest, eye - stroke);
    if (!res.ok) return { ok: false, reason: res.reason, at: stroke, samples, eye };
    q = res.q;
    samples.push({ stroke, q: Float64Array.from(q), ax: q[2 * mech.axle], ay: q[2 * mech.axle + 1] });
  }

  const y0 = samples[0].ay;
  for (const p of samples) p.travel = p.ay - y0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    samples[i].lr = (b.travel - a.travel) / (b.stroke - a.stroke);
  }
  return { ok: true, samples, eye };
}

/** Headline numbers. Anti-squat and anti-rise are NOT here yet — see CLAUDE.md. */
export function metrics(sweep, opts = {}) {
  if (!sweep.ok) return null;
  const s = sweep.samples;
  const lr0 = s[1].lr, lr1 = s[s.length - 2].lr;
  const bb = opts.bb ?? { x: 0, y: 0 };
  const chain0 = Math.hypot(s[0].ax - bb.x, s[0].ay - bb.y);
  const chainMax = Math.max(...s.map((p) => Math.hypot(p.ax - bb.x, p.ay - bb.y)));
  const growth = chainMax - chain0;
  const cogRadius = ((opts.cogTeeth ?? 30) * 12.7) / (2 * Math.PI);
  return {
    travel: s[s.length - 1].travel,
    eye: sweep.eye,
    lr0, lr1,
    progression: ((lr0 - lr1) / lr0) * 100,
    axleShift: s[s.length - 1].ax - s[0].ax,
    chainGrowth: growth,                                  // straight-line chain, no wrap
    pedalKickback: (growth / cogRadius) * (180 / Math.PI),
  };
}
