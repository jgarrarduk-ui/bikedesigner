# Flex-stay kinematics

Browser tool for designing a flex-stay full-suspension mountain bike frame.
Single self-contained page, no build step, no dependencies.

Live: `jgarrarduk-ui.github.io/bikedesigner/flexstay/`

## What it does

Solves the four-bar kinematics of a single pivot with a shock link, where the
seat stay carries the compliance instead of a pivot. Drag any pivot or type
coordinates and everything recomputes: leverage ratio, anti-squat, anti-rise,
chain shortening, axle path, spring rate, static pivot loads, derailleur cage
take-up, and the bending stress in the seat stay including the axial load acting
through the offset of the bend.

Front and rear suspension cycle together. Defaults are James's Galago geometry.

## Layout

```
index.html    the tool
img/          artwork: shock in four pieces, fork lowers
test/         headless regression tests
CLAUDE.md     architecture, traps, and what is not done
```

## Tests

```
cd test && node flexstay-tests.mjs
```

Nothing to install. The engine has no DOM references so the tests extract and run
it directly.

## Validated against Linkage X3

| | Linkage | Tool |
|---|---|---|
| Travel | 139 mm | 139.0 |
| Progression | 11.3% | 11.4% |
| Anti-squat | 113.5% | 113.4% |
| Anti-rise | 109.5% | 109.5% |

Those four are regression tests. If a change moves them, the change is wrong.

## Deploying

Copy the folder into the Pages repo and push. If the repo has no `.nojekyll` at
its root, add one — Jekyll ignores directories beginning with an underscore, and
it is easier to add the file than to remember the rule later.

Test in Safari as well as Chrome. One solver bug in this tool appeared in
JavaScriptCore only and was invisible in V8.
