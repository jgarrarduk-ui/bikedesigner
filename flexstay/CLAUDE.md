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

30 checks, no install required. The engine sits between the `// ==ENGINE-START==`
and `// ==ENGINE-END==` markers and contains **no DOM references**, so the test
file extracts that block with `new Function()` and runs it headlessly. Keep it
that way — if DOM code leaks into the engine block the tests stop working.

For anything touching the drawing, render it and look at it before shipping.
`jsdom` + `cairosvg` will rasterise the SVG offline; several bugs in this tool
were only visible in a rendered image.

## Layout

Three columns: inputs left, drawing and graph in the middle, outputs right.

The left rail is ordered by how often you touch it. Pivots and shock sit open at
the top because they are what you drag while watching the graph; frame geometry,
stay section, transmission, rider and the design file are `<details class="grp">`
folds, because geometry is normally set once, first, and then left alone. The
right rail leads with travel, balance and spring — the things a pivot move
changes — and folds the pivot loads and the stay stress calculation away, with
the twelve intermediate workings behind a second fold inside the stress panel.

Collapsed, both rails fit a 950px viewport without scrolling; before this they
scrolled 2191px and 1441px. Mobile went from 4237px of document to 1900px.

One chart at a time, full strip width, paged by the arrows and the four dots.
Axis ticks are rounded to 1, 2 or 5 times a power of ten (`niceAxis`) and the
decimals come from the step, not from the quantity — a 0.5 step under a
whole-number format printed 109, 110, 110, 111 on the anti-rise axis.

**The canvas has to stay landscape.** `fitView` crops the width to fill the box,
which is harmless on a wide canvas and takes the wheels clean off a square one.
The allowed crop now tapers to zero as the box gets square, and the mobile canvas
is `min(46vh,66vw)` so it stays roughly 1.6 wide.

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

## The geometry chain

Built from the ground up, in `syncGeom()`. The ground plane is the datum and both
wheels sit on it, so each axle height is just its own radius above the ground —
the bike is level by construction and never pitches. The bottom bracket is the x
datum at `bbh` above the ground. The head tube position follows from head angle,
fork offset, axle to crown, lower headset stack and reach, which makes **stack an
output**.

Two pairs are written both ways, and `syncGeom(driver)` takes the name of the box
just typed so it knows which way to solve:

| type this | and this solves back |
|---|---|
| bottom bracket height | drop (`Rr − bbh`) |
| drop | bottom bracket height |
| head tube length | stack |
| stack | head tube length |

Consequences worth knowing. Head and seat angles are absolute against the ground
and stay exactly as typed whatever the wheels do — swapping the rear wheel moves
**drop**, not the angles. Anti-squat turns out to be almost completely insensitive
to rear wheel diameter at fixed bottom bracket height (112.8 → 113.0 → 112.3 across
26in to 32in), because the contact patch, chainring and main pivot all stay put and
only the small cog moves. That is not the same comparison as a real mullet
conversion, where the frame is fixed and the bottom bracket drops instead.

Axle to crown is measured to the crown race seat, so `hsLower` sits between it and
the bottom of the head tube: external cup 12-13mm, zero stack a few mm for the
crown race alone. With `a2cAuto` ticked, axle to crown tracks fork travel a
millimetre for a millimetre off the 160mm/571mm reference and its box is disabled;
untick it to enter a length no catalogue fork has.

The seat stay spacings are entered as full widths — rear dropout spacing and shock
mount width — and halved at the call, because `stayLoads` works in half widths.

Tyre section height isn't typed directly. The select offers width in inches —
what you'd actually buy — and `fillTyreWidths()` turns that into the `tyreR`/
`tyreF` millimetre figure the engine reads, on the approximation that an MTB
tyre's section is close to square: height = width x 25.4. 2.4in reproduces the
60.96mm this tool has always defaulted to. A width read back from an odd
`tyreR` (an older export, a hand-edited file) that doesn't match one of the
listed sizes gets its own option appended rather than silently snapping to the
nearest listed one.

Frame geometry has its own reset (`resetGeom`, `GEOM_KEYS`), separate from the
whole-tool reset in the Design file panel — everything in the Frame geometry
panel, reach through the fork, without touching pivots, shock, stay section,
drivetrain, rider or the design file. Geometry is normally set once, first,
and separately from the kinematics, so it gets its own way back to the default.

Pivots and mounts get the same treatment (`resetPoints`, `POINT_KEYS` —
MP/SP/LP/SE/SG, the four-bar's own points). **AX and FP are deliberately left
out of `POINT_KEYS`.** AX isn't a free point at all — `syncGeom()` derives it
from rear centre and BB height every time, so resetting it here would just be
overwritten on the next sync regardless. FP is set to wherever AX *currently*
is (`G.FP={...G.AX}`) rather than to the frozen default coordinate, restoring
the concentric flex pivot this bike is meant to have even if the frame
geometry — and therefore the axle position — has since moved from default.

## Save / load

Design name and designer are free text, so they live in `META`, outside `C` —
`fillCfg()` runs every field in `C` through `parseFloat` when it wires up its
input, which would permanently reject a name the moment it looked at the box.
Export writes `{_meta:{name, designer, date, version}, geom:G, cfg:C}`; import
parses that same shape, replaces `G`/`C` wholesale, and then runs the exact
startup sequence the reset button uses — `syncGeom(); fillPoints(); fillCfg();`
— so a file with an old or partial `cfg` still comes out through the same
derivation the app applies on every other input change.

## Validated against Linkage X3

The validation belongs to the **solver**, not to whatever the app ships as its
defaults. `test/flexstay-tests.mjs` holds a frozen `REF` geometry — the one these
numbers were measured on — and the Linkage assertions run against that, so the
defaults can be changed without quietly invalidating them. Do not edit `REF` to
make a test pass. The shipped defaults get their own check that they still solve.

These are regression tests — if a change moves them, the change is wrong.

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

**The contact patch stays on the ground through the travel.** It used to be
`AX.y - Rr`, one radius below the *current* axle, so it climbed into the air as
the suspension compressed and the anti-squat datum went with it. The wheel rolls
on the ground and the frame moves down onto it, so `CP.y` is fixed at
`g.AX.y - Rr`, the un-compressed contact height. Only `CP.x` tracks the axle.
The two definitions agree at top out, which is why the Linkage numbers did not
move when this was fixed — but at sag anti-squat went 100 to 112 and anti-rise
98 to 109.

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

**The canvas SVG is absolutely positioned.** With `height:100%` in normal flow it
resolves its height from its own viewBox aspect ratio instead of from the flex
row, which pushed the page 38px past the viewport. `position:absolute` inside the
relative `#canvas` breaks that loop.

**Both panels fit themselves to their own pixel box**, so the first paint can land
before the flex layout settles. A `ResizeObserver` on `#canvas` and `#charts`
refits; the window resize listener alone is not enough.

**Pivot hit targets are sized in screen pixels**, `HIT_PX * mmPerPx`, so they stay
grabbable at any zoom. The decorative ring and dot carry `pointer-events:none` and
the handler uses `closest('.drag')` — before that, a click on the exact centre of a
pivot hit the decorative dot, which has no `dataset.key`, and silently did nothing.

**The rear axle is derived from rear centre and bottom bracket height.**
`syncGeom()` rewrites `G.AX` from them on every input change and carries `G.FP`
with it while the two are concentric, so a drag of that point has to write back
into `C.rc` and `C.bbh` or the next sync silently undoes it. The drag handler
does exactly that.

**Anti-squat reads `cfg.fax`, which `recompute()` overwrites** with
`frame(0).FA.x`. Anything calling `sweep()` directly — the tests do — supplies its
own `fax` and never gets that overwrite, so a stale value there means the tests and
the app measure at different places. `DEF.cfg.fax` is kept in step with the default
geometry for the same reason.

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

## Overlays

Four toggles in the bar. Axle path is on by default, the rest off. Force vectors resolve `pivotForces`
for the frame on screen. Anti-squat and anti-rise are separate toggles that share
one construction block: the front axle vertical and the 100% of centre-of-mass
-height mark are drawn for either, the chain run and axle-to-instant-centre lines
only for anti-squat since braking does not involve the chain.

**The framing is fixed.** `fitView` takes its content box from the static geometry
— `frame(0)` and the top-out axle — so cycling the suspension, holding at sag or
turning an overlay on cannot make the view breathe. Only the geometry inputs, the
canvas size and the zoom control move it. That means the anti-squat rays can leave
the top of the view; their labels are clamped back inside and stacked rather than
zooming out to chase them. Labels inside the drawing need their own `scale(1,-1)`
because the group they sit in is y-flipped.

**The axle path needs a casing.** It runs up out of the flex pivot along the seat
stay and over the spokes, so as a thin `#134463` line it was invisible against a
30mm-wide stay of exactly that colour. It is a pale halo under a contrasting dash.

## Parts toggles

Six buttons — wheels, drivetrain, cockpit, saddle, shock, fork — hide one piece
of artwork each, all on by default (`showWheels` etc.). They share the bar's one
toggle cluster with the overlays (axle path, anti-squat, anti-rise, forces)
rather than getting a second divider: `.partbtn` gives them `--link` teal against
the overlays' `--rear` blue, so the two kinds of pressed button read apart by
colour instead of by a text label or a second border. The frame itself (front
triangle, rear stay, shock link) is never one of them; only bolt-on product
artwork is. This is where a future crank image replaces the chainring/cog rings
under the drivetrain flag, without touching anything else.

The position readout shows current alongside total for both numbers — wheel
travel and shock stroke — so the slider reads as a fraction of travel, not a
bare position: "70/139mm wheel · 30.9/65.0mm shock". Total wheel travel is the
last swept frame's `rise`; total shock stroke is the typed spec, `C.stroke`.
Full wording is still in the `title` for a hover.

**`#bar` spreads its controls only when they actually fit one line.**
`justify-content:space-between` looks right full-width, but on a wrapped line
it stretches whatever's left over that line's own width too — a short trailing
row of leftover buttons ends up spread edge to edge with huge gaps, which reads
as broken rather than tidy. `fitBar()` measures the real content width (walking
into `.bargroup`, which is `display:contents` so its own `getBoundingClientRect`
is empty) against the bar's, and only then adds the `spread` class; otherwise
the bar falls back to plain left-aligned wrapping. Sixteen buttons plus a
220px slider need roughly 1890px of window before they fit one line — call it
a wide monitor, not a laptop — so most sessions will see it wrap, evenly
spread only within whatever line it lands on.

`drivetrain` covers the chainring and cog rings, the chain line, and the rear
derailleur — `guide`/`tension`/`up` are still computed unconditionally because the
derailleur draw call, further down in `draw()`, needs them whether or not the
toggle is on. `cockpit` covers both the stem art and the headset/steerer stack
tube, drawn in two separate places. The exposed seatpost and the shock link
(the actual rocker, teal) are frame, not toggled by anything.

## Lock shock

`lockLen` defaults **on**. Eye to eye is a real product spec, not a free variable,
so dragging one shock mount moves the frame around a fixed shock length by
default rather than silently stretching it; the drag handler already had this
logic (it moves the far eye to hold `C.eye`), it just used to start disarmed.

## Tube shape

Frame tubes use `'stroke-linecap':'round'`. **Tried `'square'` once** (flat,
square-cut ends like the frame designer tool) and reverted it: a round cap
extends a full radius in every direction, so it blends two tubes into one
silhouette whatever angle they happen to meet at, but a square cap only
extends along the tube's own axis — no sideways forgiveness. That held up fine
at simple two-tube joints (head tube, seat top, shock link) but left visible
seams at the bottom bracket, where down tube and seat tube converge from two
different angles, and along the rear stay's multi-segment path. Don't retry
this without also solving the BB and rear-stay joints — e.g. drawing them as
one path so linejoin can round the internal corners, or overlaying a circle
at the BB the width of a real bottom bracket shell.

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
