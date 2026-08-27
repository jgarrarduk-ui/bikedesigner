import test from "node:test";
import assert from "node:assert/strict";
import { sweepMech, metrics } from "./solver.js";
import { PRESETS, checkDof } from "./presets.js";

const near = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) < tol, `${what}: got ${a.toFixed(2)}, expected ${b} +/- ${tol}`);

test("every preset is a square 1-DOF system", () => {
  for (const [name, m] of Object.entries(PRESETS)) {
    const d = checkDof(m);
    assert.ok(d.ok, `${name}: ${d.constraints} constraints vs ${d.unknowns} unknowns`);
  }
});

test("every preset sweeps its full stroke without binding", () => {
  for (const [name, m] of Object.entries(PRESETS)) {
    const s = sweepMech(m, 60);
    assert.ok(s.ok, `${name} failed: ${s.reason} at ${s.at}`);
    assert.equal(s.samples.length, 61);
  }
});

test("wheel rises and leverage falls through the stroke", () => {
  for (const [name, m] of Object.entries(PRESETS)) {
    const k = metrics(sweepMech(m, 60));
    assert.ok(k.travel > 100, `${name} travel too small: ${k.travel}`);
    assert.ok(k.lr0 > k.lr1, `${name} is regressive: ${k.lr0} -> ${k.lr1}`);
  }
});

test("Horst preset matches its inverse-design targets", () => {
  const k = metrics(sweepMech(PRESETS["Horst link"], 60));
  near(k.travel, 160.1, 1.5, "travel");
  near(k.eye, 210, 1.5, "eye-to-eye");
  near(k.lr0, 3.0, 0.05, "leverage at top");
  near(k.lr1, 2.35, 0.05, "leverage at bottom");
});

test("twin link preset matches its inverse-design targets", () => {
  const k = metrics(sweepMech(PRESETS["Twin link"], 60));
  near(k.travel, 152.6, 2, "travel");
  near(k.lr0, 3.0, 0.05, "leverage at top");
  near(k.lr1, 2.35, 0.05, "leverage at bottom");
});

test("single pivot axle path is a pure arc about the main pivot", () => {
  const m = PRESETS["Single pivot"];
  const s = sweepMech(m, 40);
  const mp = m.nodes[0];
  const r0 = Math.hypot(s.samples[0].ax - mp.x, s.samples[0].ay - mp.y);
  for (const p of s.samples) {
    near(Math.hypot(p.ax - mp.x, p.ay - mp.y), r0, 0.02, "radius from main pivot");
  }
});

test("solver detects a mechanism that is not 1-DOF", () => {
  const bad = JSON.parse(JSON.stringify(PRESETS["Single pivot"]));
  bad.links.push([1, 3]);
  const s = sweepMech(bad, 5);
  assert.equal(s.ok, false);
  assert.match(s.reason, /not 1-DOF/);
});
