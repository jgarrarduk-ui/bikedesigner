# Linkwork

Browser-based mountain bike suspension kinematics tool. Free, no login, eventually
open source. Competing with Linkage X3, which is Windows-only, file-based and does
not do inverse design.

## The one architectural decision

**There is no per-layout maths anywhere and there never will be.** A mechanism is a
graph: nodes (pivots), rigid distance constraints (links), and one driver (the
shock). Single pivot, four-bar, Horst, twin-link, six-bar and idler routings are all
the same solver with a different graph.

The tempting alternative — closed-form solutions per layout — is a trap. It does not
generalise to user-built mechanisms and forces a total rewrite later. If a change
requires knowing "is this a Horst link", the change is wrong.

## Solver

`src/lib/solver.js`. Newton-Raphson on the constraint residual vector, dense
Gauss-Jordan for the linear step, backtracking line search for robustness, warm
started from the previous stroke position.

Two invariants that will bite:

1. **The system must be square.** For N nodes there are 2N unknowns, and
   `2*(fixed nodes) + links + 1 driver` must equal 2N. A rigid body spanning k nodes
   needs exactly 2k-3 links, so triangulate it — do not add every possible edge.
   `checkDof()` in `presets.js` checks this. The solver reports "not 1-DOF" rather
   than silently producing nonsense.
2. **Warm starting is load-bearing.** Without it the solver picks the wrong assembly
   branch part way through a sweep and the linkage flips inside out.

A "linkage binds" failure is usually real, not a solver bug. Most common cause: the
shock cannot shorten as far as the stroke demands, because
`|shockGround - rockerPivot| - |rockerPivot - shockMount|` sets a hard floor on
achievable eye-to-eye length. Check that before touching the solver.

## Inverse design

The differentiator. Give target travel, leverage at top and leverage at bottom, and
it places the pivots. Currently a chunked hill climb with a regularisation term that
keeps the result near the current shape, so it does not wander into something
unbuildable.

The Horst and twin-link presets were generated this way, not drawn by hand. They are
regression fixtures: if solver changes move those numbers, something broke.

Known weak: a hill climb copes with three or four scalar targets and will struggle
with a full target *curve*. The proper version is least squares against a sampled
leverage curve with analytic gradients from the Jacobian we already build.

## What is not modelled yet

**Anti-squat and anti-rise.** Deliberately absent rather than approximated, because a
plausible-looking wrong number is the fastest way to lose credibility with the people
who would actually use this. The generic approach, no layout special-casing:

1. Node velocities by finite difference between adjacent sweep samples — the samples
   already carry the full coordinate vector `q` for exactly this reason.
2. Instant centre of the rear-wheel-carrying body from the velocities of two of its
   nodes (intersection of the perpendiculars).
3. Chain force line from the cog/chainring tangent, via any idler.
4. Instantaneous force centre, then the squat line from the rear contact patch, then
   the percentage against centre-of-mass height.

Anti-rise needs to know which body the brake caliper is mounted to — that is a
property of the mechanism, so add it to the data model when you get there.

Also missing: chain wrap (chain growth currently uses a straight line on a 30t cog,
and says so in the UI), spring and damper curves, wheel rate, bottom-out force,
save/load, URL sharing, building a mechanism from scratch by placing nodes.

## Validation gate

Before showing this to anyone: reproduce published leverage curves for a handful of
real production bikes and check them in as tests. Nothing else buys trust.

## Conventions

- Millimetres. Origin at the bottom bracket. x positive forward, y positive up.
- No layout names in solver code.
- Errors name the physical cause ("linkage binds — mechanism limit reached"), never
  the numerical symptom.
- `npm test` must stay green. The presets are fixtures, not decoration.

## Longer term

The reason this exists beyond being a useful free tool: kinematics gives pivot
reaction forces, which gives member loads, which sizes 3D-printed lugs and bearings.
Nobody joins those dots. Keep the solver clean enough that force output can be layered
on top without a rewrite.
