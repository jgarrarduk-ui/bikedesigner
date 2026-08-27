/**
 * Reference mechanisms. Coordinates in millimetres, origin at the bottom
 * bracket, x positive forward, y positive up.
 *
 * The Horst and twin-link node positions were produced by the inverse solver
 * against targets of 160 mm travel, leverage 3.00 -> 2.35, 210 mm eye-to-eye.
 * They are not hand-drawn, so treat them as regression fixtures: if you change
 * the solver and these numbers move, something broke.
 */

export const PRESETS = {
  "Single pivot": {
    nodes: [
      { id: "MP", x: -25, y: 55, fixed: true },     // main pivot, grounded
      { id: "AXLE", x: -440, y: 30 },
      { id: "SM", x: -175, y: 130 },                // shock mount on swingarm
      { id: "SG", x: 45, y: 330, fixed: true },     // shock mount on front triangle
    ],
    links: [[0, 1], [0, 2], [1, 2]],                // swingarm is one rigid triangle
    driver: [3, 2],
    axle: 1,
    stroke: 65,
  },

  "Horst link": {
    nodes: [
      { id: "MP", x: -15, y: 40, fixed: true },
      { id: "HL", x: -393.3, y: -0.3 },             // chainstay/seatstay pivot, ahead of axle
      { id: "AXLE", x: -440, y: 30 },
      { id: "SST", x: -179, y: 318.1 },             // seatstay to rocker
      { id: "RP", x: -84.7, y: 328.6, fixed: true },
      { id: "SH", x: -55.7, y: 368.6 },             // shock mount on rocker
      { id: "SG", x: -22.6, y: 161.1, fixed: true },
    ],
    links: [[0, 1], [0, 2], [1, 2], [1, 3], [4, 3], [4, 5], [3, 5]],
    driver: [6, 5],
    axle: 2,
    stroke: 62.5,
  },

  "Twin link": {
    nodes: [
      { id: "LLg", x: 10.9, y: 101.4, fixed: true },
      { id: "LLs", x: -21.5, y: 47.5 },
      { id: "ULg", x: -70.3, y: 301.4, fixed: true },
      { id: "ULs", x: -140.2, y: 307.1 },
      { id: "AXLE", x: -440, y: 30 },
      { id: "SH", x: -46.4, y: 353.6 },             // shock driven off the upper link
      { id: "SG", x: 69.4, y: 178.5, fixed: true },
    ],
    links: [[0, 1], [1, 3], [1, 4], [3, 4], [2, 3], [2, 5], [3, 5]],
    driver: [6, 5],
    axle: 4,
    stroke: 62.5,
  },
};

export const clone = (m) => JSON.parse(JSON.stringify(m));

/** Square-system check. Run this on any user-built mechanism before solving. */
export function checkDof(mech) {
  const unknowns = mech.nodes.length * 2;
  const constraints = mech.nodes.filter((n) => n.fixed).length * 2 + mech.links.length + 1;
  return { unknowns, constraints, ok: unknowns === constraints };
}
