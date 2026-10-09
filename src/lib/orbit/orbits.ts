// ---------------------------------------------------------------------------
// Orbital model. World space is Y-up; the mean orbital plane is y = 0 (XZ).
// Each orbit is a Kepler ellipse with the central body at one focus, defined
// by classical elements: semi-major axis a, eccentricity e, inclination i to
// the mean plane, longitude of the ascending node (node) and argument of
// periapsis (periapsis). Within one system, periods follow Kepler's third law
// under one gravitational parameter, T = 2*pi*sqrt(a^3 / mu), fixed so the
// inner overview orbit takes INNER_PERIOD. History: 48 s in the first proof,
// 32 s (Brandon, 2026-09-30: "sped up by 50%"), now 24 s (Brandon,
// 2026-09-30: "would still like these moons to orbit faster"; a further 25%
// cut, 2x the original speed). All bodies read one shared clock.
// ---------------------------------------------------------------------------
export type Orbit = {
  a: number;
  e: number;
  /** Mean anomaly at t = 0 (radians). */
  phase: number;
  /** Inclination to the mean plane (radians). */
  inclination: number;
  /** Longitude of the ascending node, measured in the mean plane (radians). */
  node: number;
  /** Argument of periapsis within the orbital plane (radians). */
  periapsis: number;
  period: number;
};
export type Vec3 = [number, number, number];
const DEG = Math.PI / 180;
/** Period of the inner overview orbit, seconds. */
export const INNER_PERIOD = 24;
/** Gravitational parameter that gives an orbit of semi-major axis `a` the period `period`. */
export function muFor(a: number, period = INNER_PERIOD) {
  return (4 * Math.PI * Math.PI * a ** 3) / period ** 2;
}
export function keplerPeriod(a: number, mu: number) {
  return 2 * Math.PI * Math.sqrt(a ** 3 / mu);
}
export function makeOrbit(
  a: number,
  e: number,
  inclinationDeg: number,
  nodeDeg: number,
  periapsisDeg: number,
  phase: number,
  mu: number,
): Orbit {
  return {
    a,
    e,
    phase,
    inclination: inclinationDeg * DEG,
    node: nodeDeg * DEG,
    periapsis: periapsisDeg * DEG,
    period: keplerPeriod(a, mu),
  };
}
/**
 * Overview layouts. The orbit shapes (eccentricity, planes, nodes, periapses,
 * phases) are shared; only the semi-major axes differ, because the clearance
 * rules depend on the drawn body size:
 *
 * - `spheres` (the default moon style): three spherical moons, so the orbits
 *   pack tighter around the enlarged planet and the planet reads larger.
 * - `boxed` (`shapes` and `detailed`): the cube's and octahedron's bounding
 *   spheres are larger, so the orbits sit further out.
 *
 * Three distinct planes (22, 8 and 35 degrees). The inner and outer nodes
 * are chosen so their planes lean opposite ways across the view (the
 * ellipses cross like real inclined rings rather than nesting); periapses
 * are placed so each pair's closest radial approach falls away from their
 * mutual node line. Each layout has its own gravitational parameter so its
 * inner orbit takes INNER_PERIOD.
 */
export type Layout = 'spheres' | 'boxed';
export const LAYOUTS: readonly Layout[] = ['spheres', 'boxed'];
export const DEFAULT_LAYOUT: Layout = 'spheres';
/** Moon styles map to layouts: only `spheres` has all-spherical bodies. */
export function layoutFor(style: string): Layout {
  return style === 'spheres' ? 'spheres' : 'boxed';
}
const LAYOUT_A: Record<Layout, [number, number, number]> = {
  spheres: [2.58, 3.67, 4.63],
  boxed: [2.78, 4.06, 5.19],
};
export const OVERVIEW_MU: Record<Layout, number> = {
  spheres: muFor(LAYOUT_A.spheres[0]),
  boxed: muFor(LAYOUT_A.boxed[0]),
};
function overviewLayout(layout: Layout): Orbit[] {
  const [a0, a1, a2] = LAYOUT_A[layout],
    mu = OVERVIEW_MU[layout];
  return [
    makeOrbit(a0, 0.04, 22, -60, 135, 2.4, mu),
    makeOrbit(a1, 0.05, 8, 150, 270, 5.4, mu),
    makeOrbit(a2, 0.035, 35, 100, 0, 1.0, mu),
  ];
}
const OVERVIEW_ORBITS: Record<Layout, Orbit[]> = {
  spheres: overviewLayout('spheres'),
  boxed: overviewLayout('boxed'),
};
export function overviewOrbits(layout: Layout = DEFAULT_LAYOUT) {
  return OVERVIEW_ORBITS[layout];
}
/** The default (spheres) overview. */
export const ORBITS = OVERVIEW_ORBITS[DEFAULT_LAYOUT];
/** Position at simulation time t (seconds) on the shared clock. */
export function orbitPosition(o: Orbit, t: number): Vec3 {
  const M = (o.phase + (2 * Math.PI * t) / o.period) % (2 * Math.PI);
  let E = M;
  for (let i = 0; i < 7; i++)
    E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
  // Perifocal frame: focus at the origin, periapsis along +x.
  const px = o.a * (Math.cos(E) - o.e),
    py = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  // Rz(node) * Rx(i) * Rz(periapsis) in a Z-up frame, then Z-up -> Y-up.
  const cw = Math.cos(o.periapsis),
    sw = Math.sin(o.periapsis),
    ci = Math.cos(o.inclination),
    si = Math.sin(o.inclination),
    cn = Math.cos(o.node),
    sn = Math.sin(o.node);
  const x1 = px * cw - py * sw,
    y1 = px * sw + py * cw;
  const y2 = y1 * ci,
    z2 = y1 * si;
  const x3 = x1 * cn - y2 * sn,
    y3 = x1 * sn + y2 * cn;
  return [x3, z2, -y3];
}
/** Unit normal of the orbital plane (Y-up world). */
export function orbitNormal(o: Orbit): Vec3 {
  const si = Math.sin(o.inclination);
  return [si * Math.sin(o.node), Math.cos(o.inclination), si * Math.cos(o.node)];
}
export function ease(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Child phases are chosen so the three items start spread around the centre
 * (right, upper left, lower right) rather than bunching in the top half, and
 * clear of the top-left corner where the shrunken overview rests. Planes
 * follow the overview pattern (18, 6 and 30 degrees).
 */
/**
 * The child system keeps its geometry (children keep their world size), and
 * its gravitational parameter is that of the previous 2.32-unit overview at
 * the new inner period, so child periods drop by exactly the same 25% as the
 * overview's (29.5/45.9/61.9 s -> 22.2/34.4/46.4 s).
 */
export const CHILD_MU = muFor(2.32);
export const CHILD_ORBITS = [
  makeOrbit(2.2, 0.04, 18, -50, 135, 4.5, CHILD_MU),
  makeOrbit(2.95, 0.05, 6, 160, 270, 1.3, CHILD_MU),
  makeOrbit(3.6, 0.03, 30, 110, 0, 3.3, CHILD_MU),
];
/**
 * Moons are drawn 40% larger than the first proof (1.3 until 2026-09-30; they
 * grew a touch with the planet so the planet:moon ratio does not collapse).
 * The planet grew 25% (1.4 -> 1.75, Brandon 2026-09-30: "the central planet
 * should be larger"); the overview layouts above were re-spaced so
 * phase-independent path clearance still holds at these sizes.
 */
export const MOON_SCALE = 1.4;
/** Bounding radii of the `shapes` bodies: cube half-diagonal, sphere, octahedron. */
export const BODY_RADII = [0.451, 0.29, 0.37].map((r) => r * MOON_SCALE);
/**
 * Radii of the `spheres` bodies (Portfolio basalt, Playbooks rust, Approach
 * ivory). Mirrors SPHERE_RADII in lib/moon-style.ts (a test keeps them equal);
 * repeated here so this module stays import-free for the Node tests.
 */
export const SPHERE_BODY_RADII = [0.33, 0.29, 0.255].map((r) => r * MOON_SCALE);
export function bodyRadii(layout: Layout = DEFAULT_LAYOUT) {
  return layout === 'spheres' ? SPHERE_BODY_RADII : BODY_RADII;
}
/** Centre enlargement is divided by MOON_SCALE so a centred world keeps its size. */
export const CENTER_SCALES = [3.2, 4.7, 4.1].map((s) => s / MOON_SCALE);
/** Child items keep their previous world size (0.62 x 1.12 of the first proof). */
export const CHILD_SCALE = (0.62 * 1.12) / MOON_SCALE;
export const PLANET_RADIUS = 1.75;
/**
 * Inside a collection the whole overview shrinks into the top-left corner.
 * The shrink is relative to the outer orbit so the corner system keeps the
 * screen size it had with the 4.58-unit outer orbit (0.24x).
 */
export function cornerScale(layout: Layout = DEFAULT_LAYOUT) {
  return (0.24 * 4.58) / LAYOUT_A[layout][2];
}
/**
 * Radius of the planet's bright limb halo (one e-fold of the corona in
 * lib/planet.ts); no moon surface may enter it.
 */
export const GLOW_RADIUS = PLANET_RADIUS * 1.1;
/**
 * Depth cue on top of perspective: a body at the near edge of its orbit is
 * drawn DEPTH_SCALE[1] times its size, at the far edge DEPTH_SCALE[0].
 */
export const DEPTH_SCALE: [number, number] = [0.9, 1.1];
export function depthScale(depth: number, centreDepth: number, reach: number) {
  const k = Math.min(1, Math.max(0, (depth - (centreDepth - reach)) / (2 * reach)));
  return DEPTH_SCALE[1] + (DEPTH_SCALE[0] - DEPTH_SCALE[1]) * k;
}

// ---------------------------------------------------------------------------
// Camera fit. The camera sits above the mean orbital plane (elevation) with a
// slight yaw, looks at the origin, and is fitted to the real stage aspect. A
// vertical shift (applied to the projection) centres the envelope between the
// stage toolbar and the control dock that overlays the bottom of the stage.
// ---------------------------------------------------------------------------
export const FOV_Y = 35;
const TAN = Math.tan(((FOV_Y / 2) * Math.PI) / 180);
/** Slight yaw so no orbit's node line sits exactly edge-on or square. */
export const CAMERA_YAW = 10 * DEG;
export type Pose = { distance: number; elevation: number; shift: number };
/** Allowed NDC window: y in [bottom, top], |x| <= side. */
export type Frame = { top: number; bottom: number; side: number };
type Sample = { p: Vec3; r: number };

/**
 * 25 degrees above the mean plane on wide stages; portrait phones look down
 * more steeply (up to 34 degrees) so the envelope uses the tall stage.
 */
export function viewElevation(aspect: number) {
  const t = Math.min(1, Math.max(0, (aspect - 0.75) / (1.75 - 0.75)));
  return (34 + (25 - 34) * t) * DEG;
}
export function cameraPosition(pose: Pose): Vec3 {
  const c = Math.cos(pose.elevation);
  return [
    pose.distance * c * Math.sin(CAMERA_YAW),
    pose.distance * Math.sin(pose.elevation),
    pose.distance * c * Math.cos(CAMERA_YAW),
  ];
}
/** View-space basis for a camera at `pose` looking at the origin, Y up. */
function viewBasis(pose: Pose) {
  const c = cameraPosition(pose);
  const f: Vec3 = [-c[0] / pose.distance, -c[1] / pose.distance, -c[2] / pose.distance];
  // right = f x up(0,1,0)
  let rx = -f[2],
    rz = f[0];
  const rl = Math.hypot(rx, rz);
  rx /= rl;
  rz /= rl;
  // camUp = right x f
  const u: Vec3 = [-rz * f[1], rz * f[0] - rx * f[2], rx * f[1]];
  return { c, f, right: [rx, 0, rz] as Vec3, u };
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Distance along the view axis from the camera to p. */
export function viewDepth(p: Vec3, pose: Pose) {
  const { c, f } = viewBasis(pose);
  return dot([p[0] - c[0], p[1] - c[1], p[2] - c[2]], f);
}
/** Conservative NDC bounds of a sphere of radius r at p. */
export function projectBounds(
  p: Vec3,
  r: number,
  pose: Pose,
  aspect: number,
) {
  const { c, f, right, u } = viewBasis(pose);
  const d: Vec3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const xv = dot(d, right),
    yv = dot(d, u);
  const depth = dot(d, f) - r;
  const k = 1 / (Math.max(depth, 1e-3) * TAN);
  return {
    left: ((xv - r) * k) / aspect,
    right: ((xv + r) * k) / aspect,
    bottom: (yv - r) * k + pose.shift,
    top: (yv + r) * k + pose.shift,
    depth,
  };
}
function sampleOrbits(orbits: Orbit[], radii: number[], steps = 360) {
  const out: Sample[] = [];
  orbits.forEach((o, i) => {
    for (let j = 0; j < steps; j++)
      out.push({
        p: orbitPosition(o, (j / steps) * o.period),
        r: radii[i] * DEPTH_SCALE[1],
      });
  });
  return out;
}
const overviewCache: Partial<Record<Layout, Sample[]>> = {};
let collectionCache: Sample[] | null = null;
export function overviewSamples(layout: Layout = DEFAULT_LAYOUT) {
  return (overviewCache[layout] ??= [
    { p: [0, 0, 0], r: GLOW_RADIUS },
    ...sampleOrbits(overviewOrbits(layout), bodyRadii(layout)),
  ]);
}
export function collectionSamples() {
  return (collectionCache ??= [
    {
      p: [0, 0, 0],
      r: Math.max(...CENTER_SCALES.map((s, i) => s * BODY_RADII[i])) * 1.03,
    },
    ...sampleOrbits(
      CHILD_ORBITS,
      BODY_RADII.map((r) => r * CHILD_SCALE),
    ),
  ]);
}
function extent(samples: Sample[], pose: Pose, aspect: number) {
  let top = -Infinity,
    bottom = Infinity,
    side = 0,
    near = Infinity;
  for (const { p, r } of samples) {
    const b = projectBounds(p, r, pose, aspect);
    top = Math.max(top, b.top);
    bottom = Math.min(bottom, b.bottom);
    side = Math.max(side, Math.abs(b.left), Math.abs(b.right));
    near = Math.min(near, b.depth);
  }
  return { top, bottom, side, near };
}
/** Smallest camera distance at which every sample fits the frame. */
export function fitPose(
  samples: Sample[],
  aspect: number,
  frame: Frame,
): Pose {
  const elevation = viewElevation(aspect);
  const span = frame.top - frame.bottom;
  let lo = 2,
    hi = 80;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const e = extent(samples, { distance: mid, elevation, shift: 0 }, aspect);
    if (e.near > 0.5 && e.top - e.bottom <= span && e.side <= frame.side)
      hi = mid;
    else lo = mid;
  }
  const e = extent(samples, { distance: hi, elevation, shift: 0 }, aspect);
  return {
    distance: hi,
    elevation,
    shift: (frame.top + frame.bottom) / 2 - (e.top + e.bottom) / 2,
  };
}
/** Stage-relative frame: reserve the toolbar above and the dock below. */
export function stageFrame(
  width: number,
  height: number,
  reserve = stageReserve(width),
): Frame {
  return {
    top: 1 - (2 * reserve.top) / height,
    bottom: -1 + (2 * reserve.bottom) / height,
    side: width / height < 1.2 ? 0.86 : 0.9,
  };
}
/** Pixel space held by the toolbar (top) and the dock overlay (bottom). */
export function stageReserve(width: number) {
  return width < 600 ? { top: 56, bottom: 74 } : { top: 52, bottom: 70 };
}
export function overviewPose(width: number, height: number, layout: Layout = DEFAULT_LAYOUT) {
  return fitPose(overviewSamples(layout), width / height, stageFrame(width, height));
}
export function collectionPose(width: number, height: number) {
  return fitPose(
    collectionSamples(),
    width / height,
    stageFrame(width, height),
  );
}
/** Kept for callers of the first proof: overview distance for an aspect. */
export function cameraDistance(aspect: number) {
  return overviewPose(aspect * 570, 570).distance;
}
