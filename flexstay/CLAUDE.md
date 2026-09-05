# Flex-stay kinematics tool — working notes

Single-file browser tool for a flex-stay full-suspension MTB. No build step, no
dependencies. `index.html` plus five PNGs in `img/`.

## Run it

Open `index.html`, or serve the folder. It is deployed to GitHub Pages alongside
`frame-designer.html`.

## Test it

```
cd test && node flexstay-tests.mjs
```

23 checks, no install required. The engine sits between the `// ==ENGINE-START==`
and `// ==ENGINE-END==` markers and contains **no DOM references**, so the test
file extracts that block with `new Function()` and runs it headlessly. Keep it
that way — if DOM code leaks into the engine block the tests stop working.

For anything touching the drawing, render it and look at it before shipping.
`jsdom` + `cairosvg` will rasterise the SVG offline; several bugs in this tool
were only visible in a rendered image.

## The model

Four-bar, one degree of freedom.

| Body | Contains | Constraint |
|---|---|---|
| A | chainstay, rear axle, flex pivot | pinned to frame at main pivot |
| B | upper stay, link pivot, shock eye | pinned to A at flex pivot |
| shock link | link pivot to second pivot | pinned to frame at second pivot |

The flex pivot is fixed at the rear axle. The seat stay is drawn from its real
bend geometry: a straight run out of the dropout, a fixed radius bend, then a
straight run to the yoke, with the launch angle solved so both ends stay on
their pivots.

Coordinates are millimetres, origin at the bottom bracket, x forward, y up. The
drawing group applies `scale(1,-1)` so the SVG is y-down inside a y-up model.

## Validated against Linkage X3

The defaults reproduce James's own model. These are regression tests — if a
change moves them, the change is wrong.

| | Linkage | Tool |
|---|---|---|
| Travel | 139 | 139.0 |
| Progression | 11.3% | 11.4% |
| Anti-squat | 113.5% | 113.4% |
| Anti-rise | 109.5% | 109.5% |

## Traps

**Floating point noise at zero compression.** At top-out the target shock length
*is* the current length, so the bracketing residual should be zero but comes out
as noise of either sign — the rigid-body transform round-trips through `atan2`.
Treating that as a real sign meant the solver reported a jam on the first frame.
V8 lands positive, JavaScriptCore lands negative, so it worked in Chrome and
failed in Safari. Anything inside 1e-6 is now treated as a root. The jitter test
catches regressions: with the old code 176 of 400 jittered geometries jammed.

**Test in Safari as well as Chrome.** See above.

**Anti-squat is read at the front axle vertical**, not the centre-of-mass
vertical, and heights are measured from the ground, not from y=0. Getting either
wrong makes a low main pivot look like it produces no anti-squat.

**Wheel size is rim bead diameter plus tyre height.** Treating "29 inches" as an
outer diameter and adding tyre on top gives a 427mm radius.

**`P` is the chain pitch constant** in the engine. Do not shadow it inside
`draw()` — a local `const P` puts the earlier drivetrain code in the temporal
dead zone and the whole frame silently vanishes.

**Partial sweeps.** A jammed linkage returns a partial frame list. Leverage needs
a neighbour each side, so the first frame's `lr` is undefined. Readouts bail to
dashes below three frames.

**Never blank the canvas.** `draw`, `readouts` and `charts` each run in their own
try/catch, and `topFrame()` supplies the geometry as drawn when the linkage will
not solve. A failure in one panel must not take the drawing with it.

**Number inputs and scroll wheels.** A wheel over a focused number input silently
edits it in most browsers. They blur on wheel.

## Stay structure

Two effects on the same tube, which may add or cancel:

1. Imposed end rotation from the suspension. Propped cantilever, so peak
   curvature is twice the mean over the developed length.
2. Axial load acting through the offset of the bend, amplified by P-delta.

Whether they oppose is computed from the sign of the flex rotation against the
bend direction — it is not hard-coded. On the current geometry they oppose.

Out-of-plane bending comes from the inward lean: the stay leaves the dropout
already leaning in and the bend near the yoke takes the lean back out, so the
worst offset from the chord is at that bend. Nothing cancels it, so the two
planes are combined as a resultant moment.

Diameter changes the bending stress; **wall thickness does not**. Curvature is
imposed, so the outer fibre travels the same distance whatever the wall. Wall
changes the moment and the force, which are reported separately.

Both stays share the axial load.

## Artwork

Placed by an affine matrix built from two anchor points. The shock is sliced four
ways so only the spring section stretches — the reservoir rides with the body,
and the tail and body keep their proportions. The fork lowers never stretch: the
casting is rigid and slides up a procedurally drawn stanchion, which is the real
mechanism.

Anchors were recovered by pixel analysis (transparent bores for the shock
eyelets, largest dark blob for the fork axle). For new artwork, ask for marked
`anchor-a` / `anchor-b` circles and a `stretch-y` band instead.

`CHAINCAL` in the engine is a 9.8mm fudge calibrating the simplified chain wrap
model so a nominal chain count lands mid-range on this bike. It does not affect
how far the cage swings, which is what the drawing depends on.

## Not done

- Beam solve for the stay, letting it find its own deflected shape rather than
  being handed a curvature distribution. Would settle the end-condition question.
- Chain wrap geometry done properly — real tangents and arc angles including the
  S-wrap through the jockeys — so the link count is usable for building.
- Anti-squat referenced to the fully extended front axle rather than the current
  one. Linkage recalculates it; this does not.
- Save/load and URL sharing.
