import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPlanet, type Planet as PlanetHandle } from './planet';
import { STAGE_GROUND } from './moon-surfaces';
import { addStarDust, EdgeFeather, setEdgeFade } from './star-dust';
import { makeCraftKit, RED, IVORY, COPPER_DEEP, type CraftKit } from './formation-craft';
import { Structures, buildingMaterial, cityCluster, cityLights, riser, groundSphere, atmosphere, rng, S, WARM, type Bld, type Surface } from './structures';

/**
 * Collection heroes (ticket #16): the decorative stages beside the Portfolio and Playbooks
 * titles, a built world on the site's planet (Brandon's picks of October 13 from the built-world
 * studies, Brandon OS `analysis/2026-10-13-portfolio-built-world/`; the structure kit is shared in
 * structures.ts):
 *
 * - `portfolio` — K2 Three approaches: the planet's curve fills the lower stage with settlements
 *   on the horizon; three dashed routes of different shapes (a straight descent, a descending
 *   spiral, a coast with two burns) come down to three unequal sites (a few low blocks; a lone
 *   spire; a span with an arch between two towers). A wedge flies each route in turn and each
 *   arrival adds one element; when every site is finished the world holds, the new structures
 *   fade out, and the 72 s loop begins again.
 * - `playbooks` — F3 Limb and lights: the site's own planet up close, its limb arcing across the
 *   upper stage; three skylines stand on the limb and the terminator and the night face carries
 *   city lights clustered into lit blocks; the formation (the chevron wedge with the copper craft)
 *   flies its play low across the night face over them, a 7 s pass every 14 s. The planet's crust
 *   is held so the cities stay put, and its own emission is dimmed under the lights.
 *
 * Both are decorative, not relational (D2): the sites' counts and shapes are unequal so nothing
 * maps one-to-one onto the stories or the methods; red #F16B65 appears only as motion or trace
 * (trails and burns); no text. AI-made choices, reversible.
 *
 * Conventions follow formation-scene.ts / map-scene.ts: one WebGLRenderer, the shared render
 * profile, STAGE_GROUND clear colour, a final feather pass that blends the outer frame to the
 * exact page ground (43,45,41), a loop that runs only on screen in a visible tab, a context-loss
 * guard (the host swaps to its poster), dispose(), and frame diagnostics on the host's dataset.
 */

export type CollectionKind = 'portfolio' | 'playbooks';

export interface CollectionHooks {
  onReady(): void;
  onFailure(): void;
}

export interface CollectionHandle {
  /** Host-driven hold; offscreen pausing is automatic. */
  pause(v: boolean): void;
  resize(): void;
  dispose(): void;
}

/* ---- render profile (map-scene.ts values) ---- */
const KEY_DIR = new THREE.Vector3(-5.2, 3.4, 3.6).normalize();
const FILL_DIR = new THREE.Vector3(4, -2.5, 3).normalize();
const RIM_DIR = new THREE.Vector3(2.6, 1.8, -6).normalize();
const ADD = THREE.AdditiveBlending;
/** The studies were framed for a 760×520 stage; narrower boxes keep that horizontal extent. */
const DESIGN_ASPECT = 760 / 520;

/* ---- maths ---- */
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  kit: CraftKit;
  /** The shared structure set (one material, low window share). */
  structures: Structures;
  planet(r: number, pos: THREE.Vector3): PlanetHandle;
  glow(color: THREE.Color, size: number): THREE.Sprite;
  /** Add a mesh the stage owns (its geometry and material are disposed with the stage). */
  own<T extends THREE.Mesh>(mesh: T): T;
  /** Register anything else with a dispose(). */
  keep<T extends { dispose(): void }>(d: T): T;
  /** Camera position, target, lens and fog density, as framed in the study. */
  look: { pos: THREE.Vector3; target: THREE.Vector3; fov: number; fog: number };
}
/** `t0`: the clock at load; `poster`: the settled frame's clock; `narrowZoom`: extra zoom on
 *  phone-shaped boxes where the figure has room to spare. */
type Build = (s: Stage) => { tick(t: number): void; t0: number; poster: number; narrowZoom?: number };

/** A formation: lead + wingmen, offsets (along, side) in units of the craft spacing; the copper
 *  craft (index 3) flies inside the ivory wedge. */
const WEDGE: [number, number][] = [[0, 0], [-1, -1], [-1, 1], [-2, 0]];

/** A formation flown along a curve. size: craft size; sp: side spacing; du: along spacing in u. */
function wedge(s: Stage, size: number, sp: number, du: number) {
  const crafts = WEDGE.map((_, i) => s.kit.craft(i === 3 ? COPPER_DEEP : IVORY, size, i === 3 ? 1.6 : 1.45, true));
  const trails = WEDGE.map((_, i) => s.kit.trail(i === 3 ? 1.6 : 1.4));
  const N = 48;
  const pts: THREE.Vector3[] = Array.from({ length: N + 1 }, () => V());
  const tmp = V(),
    head = V(),
    tan = V(),
    side = V();
  const at = (curve: THREE.Curve<THREE.Vector3>, u: number, al: number, sd: number, up: THREE.Vector3, out: THREE.Vector3) => {
    const uu = clamp(u + al * du);
    curve.getPointAt(uu, out);
    curve.getTangentAt(clamp(uu, 0.001, 0.999), tan);
    side.copy(tan).cross(up).normalize();
    return out.addScaledVector(side, sd * sp);
  };
  return {
    /** u: flight progress (0..1; outside it the craft are hidden and the trail fades); tail: trail
     *  length in u; fade: trail gain. Returns the craft opacity. */
    set(curve: THREE.Curve<THREE.Vector3>, u: number, up: THREE.Vector3, tail: number, fade: number) {
      const live = u >= 0 && u < 1;
      const op = live ? ss(0, 0.07, u) * (1 - ss(0.9, 1, u)) : 0;
      const uc = clamp(u);
      WEDGE.forEach(([al, sd], i) => {
        const h = uc + al * du;
        const from = Math.max(0, h - tail);
        for (let q = 0; q <= N; q++) at(curve, mix(uc, uc - (h - from), q / N), al, sd, up, pts[q]);
        s.kit.place(crafts[i], [at(curve, uc, al, sd, up, head), at(curve, uc - 0.004, al, sd, up, tmp)]);
        crafts[i].setOpacity(op);
        crafts[i].group.visible = op > 0.01;
        const g = (live ? 0.95 : 0.6) * fade * (i === 3 ? 1 : 0.85);
        const show = u > 0.003 && h - from > 0.002 && fade > 0.003;
        s.kit.setTrail(trails[i], show ? pts : [], i === 3 ? COPPER_DEEP : RED, g, live ? 1.1 : 0.6);
      });
      return op;
    },
  };
}

function dashed(s: Stage, pts: THREE.Vector3[], alpha: number, dash: number) {
  const l = s.kit.staticLine(pts, 0xefe6d2, alpha, 1.1, true);
  const m = l.material as unknown as { dashSize: number; gapSize: number };
  m.dashSize = dash;
  m.gapSize = dash * 1.25;
  return l;
}

/** K2 Three approaches (Portfolio). */
const threeApproaches: Build = (s) => {
  const R = 9;
  const sf: Surface = { C: V(0, -R, 0), R, n0: V(0, 1, 0), e1: V(1, 0, 0), e2: V(0, 0, -1) };
  s.scene.add(s.own(groundSphere(sf, 0.42, 448, [1.2, 2.6])));
  s.scene.add(s.own(atmosphere(sf.C, R, 0.14, 1.0, KEY_DIR)));
  // A higher eye than the study (1.25), looking further down, so the spiral opens into a coil and
  // the sites stand on the ground rather than against the horizon.
  s.look.pos.set(0, 1.6, 0.15);
  s.look.target.copy(S(sf, 0.06, 2.5, 0.16));
  s.look.fov = 38;
  s.look.fog = 0.1;
  const rnd = rng(77);
  // Unequal sites (about 1.35x the study's, so they read as built on a phone): a spread of low
  // blocks (left, four additions), a lone spire (centre, three segments), a span and an arch
  // between two standing towers (right, two additions). Plus unrelated settlement on the horizon.
  const A = { x: -0.58, s: 1.78 },
    B = { x: 0.08, s: 2.4 },
    Cc = { x: 0.66, s: 1.86 };
  const k = 1.35;
  const base: Bld[] = [
    ...cityCluster(rnd, -0.2, 4.6, 2.2, 0.6, 0.32, 90, 0.07),
    ...cityCluster(rnd, 1.9, 3.2, 0.5, 0.4, 0.24, 26, 0.06),
    { type: 'twist', x: Cc.x - 0.26, s: Cc.s, w: 0.085, d: 0.085, h: 0.46, seed: 0.35 },
    { type: 'drum', x: Cc.x + 0.26, s: Cc.s, w: 0.08, d: 0.08, h: 0.4, seed: 0.62 },
    { type: 'dome', x: A.x - 0.33, s: A.s + 0.16, w: 0.16, d: 0.16, h: 0.07, seed: -1 },
  ];
  s.structures.add(sf, base);
  const sites: { steps: Bld[] }[] = [
    {
      steps: [
        { type: 'slab', x: A.x, s: A.s, w: 0.12 * k, d: 0.09 * k, h: 0.07 * k, seed: 0.2 },
        { type: 'slab', x: A.x + 0.2, s: A.s - 0.04, w: 0.09 * k, d: 0.09 * k, h: 0.11 * k, seed: 0.4 },
        { type: 'setback', x: A.x + 0.07, s: A.s + 0.17, w: 0.1 * k, d: 0.1 * k, h: 0.16 * k, seed: 0.6 },
        { type: 'dome', x: A.x - 0.16, s: A.s - 0.13, w: 0.1 * k, d: 0.1 * k, h: 0.05 * k, seed: -1 },
      ],
    },
    {
      steps: [
        { type: 'drum', x: B.x, s: B.s, w: 0.13 * k, d: 0.13 * k, h: 0.16 * k, seed: 0.3 },
        { type: 'twist', x: B.x, s: B.s, w: 0.09 * k, d: 0.09 * k, h: 0.42 * k, seed: 0.5 },
        { type: 'needle', x: B.x, s: B.s, w: 0.04 * k, d: 0.04 * k, h: 0.62 * k, seed: -1 },
      ],
    },
    {
      steps: [
        { type: 'span', x: Cc.x, s: Cc.s, w: 0.5, d: 0.03, h: 0.022, a: 0.27, seed: -1 },
        { type: 'arch', x: Cc.x, s: Cc.s, w: 0.5, d: 0.4, h: 0.4, a: 0.0, seed: -1 },
      ],
    },
  ];
  const risers = sites.map((st) => s.keep(riser(s.scene, sf, st.steps)));
  // Three route shapes, all ending on a site.
  const straight = new THREE.CatmullRomCurve3([S(sf, -1.2, 3.4, 1.15), S(sf, -0.95, 2.7, 0.62), S(sf, A.x, A.s, 0.08)]);
  // The spiral's plane is tilted toward the eye (its far side higher) so it reads as a coil.
  const spiralPts: THREE.Vector3[] = [];
  const spireTop = 0.62 * k + 0.03;
  for (let i = 0; i <= 120; i++) {
    const u = i / 120,
      ang = 0.6 + u * TAU * 1.6,
      rr = mix(0.36, 0.03, u * u);
    spiralPts.push(S(sf, B.x + Math.cos(ang) * rr, B.s + Math.sin(ang) * rr, mix(0.98, spireTop, u) + Math.sin(ang) * rr * 0.9));
  }
  const spiral = new THREE.CatmullRomCurve3(spiralPts);
  // A coast, a burn, a descending arc, a second burn onto the span.
  const b1 = S(sf, 1.12, 3.15, 0.85),
    b2 = S(sf, Cc.x + 0.06, Cc.s + 0.17, 0.42);
  const transfer = new THREE.CatmullRomCurve3(
    [S(sf, 1.7, 3.95, 1.05), S(sf, 1.42, 3.55, 0.98), b1, S(sf, 1.07, 2.6, 0.66), b2, S(sf, Cc.x, Cc.s, 0.3)],
    false,
    'centripetal',
  );
  const routes = [straight, spiral, transfer];
  routes.forEach((r) => dashed(s, r.getSpacedPoints(200), 0.36, 0.03));
  const team = routes.map(() => wedge(s, 0.085, 0.032, 0.025));
  const burns = [0, 1, 2].map((i) => s.glow(RED.clone().multiplyScalar(1.5), i === 0 ? 0.15 : 0.17));
  const kinks = [b1, b2];
  // The flights: each route in turn until its site is finished (A has four elements, B three, C
  // two), so every arrival adds one element: A B C A B C A B A. Then the finished world holds, the
  // new structures fade out (a fade, not un-building) and the loop starts again.
  const ORDER = [0, 1, 2, 0, 1, 2, 0, 1, 0];
  const SLOT = 6.5,
    FLY = 4.2,
    LOOP = 72,
    FADE0 = 66.5,
    FADE1 = 70;
  const flights = ORDER.map((j, n) => ({ j, st: n * SLOT, step: ORDER.slice(0, n).filter((x) => x === j).length }));
  const upv = V(0, 1, 0);
  return {
    t0: 3 * SLOT + 1.2,
    poster: 8 * SLOT + 2.7, // the last flight on its way down, two sites finished, the blocks three-quarters built
    tick(t) {
      const L = ((t % LOOP) + LOOP) % LOOP;
      const fadeOut = 1 - ss(FADE0, FADE1, L);
      burns.forEach((b) => (b.material.opacity = 0));
      // Each team flies its route's latest flight that has started (trails linger ~2 s after).
      routes.forEach((route, j) => {
        let f = null as (typeof flights)[number] | null;
        for (const x of flights) if (x.j === j && x.st <= L) f = x;
        const u = f ? (L - f.st) / FLY : -1;
        const fade = !f ? 0 : u < 1 ? 1 : 1 - ss(f.st + FLY, f.st + FLY + 2, L);
        team[j].set(route, u, upv, j === 1 ? 0.3 : 0.45, fade);
        if (f && u > 0 && u < 1 && j === 2) {
          kinks.forEach((kp, q) => {
            const uk = q === 0 ? 0.38 : 0.78;
            burns[q + 1].position.copy(kp);
            burns[q + 1].material.opacity = Math.exp(-(((u - uk) / 0.05) ** 2)) * 0.8;
          });
        }
      });
      for (const f of flights) {
        const arr = f.st + FLY;
        const p = ss(arr - 0.1, arr + 1, L);
        const glow = Math.exp(-((L - arr - 0.3) ** 2) / 0.35);
        risers[f.j].set(f.step, p, glow, fadeOut);
        const a = Math.exp(-(((L - arr) / 0.3) ** 2));
        if (a > 0.01) {
          burns[0].position.copy(routes[f.j].getPointAt(1));
          burns[0].material.opacity = Math.max(burns[0].material.opacity, a * 0.7);
        }
      }
    },
  };
};

/** F3 Limb and lights (Playbooks). */
const limbLights: Build = (s) => {
  const R = 3;
  const C = V(0, 0, 0);
  const planet = s.planet(R, C);
  // Under the city lights the planet's own emission (bands, fissures, filaments) is dimmed on the
  // night side, so the lit blocks are the brightest thing there. This instance's shader only.
  const body = planet.body.material as THREE.ShaderMaterial;
  if (body.fragmentShader.includes('col+=emit*calm;')) {
    body.fragmentShader = body.fragmentShader.replace('col+=emit*calm;', 'col+=emit*calm*mix(1.,.22,smoothstep(.1,-.2,ndl));');
    body.needsUpdate = true;
  }
  s.scene.add(s.own(atmosphere(C, R, 0.07, 0.55, KEY_DIR, 1.15)));
  // Camera: a waning phase (the lit crescent on the left, most of the visible face in night),
  // close over the limb so it arcs across the upper stage.
  const w = V(0.8, 0.28, 0.52).normalize();
  const D = 5.6;
  s.look.pos.copy(w).multiplyScalar(D);
  const upish = V(0, 1, 0).addScaledVector(w, -w.y).normalize();
  const right = upish.clone().cross(w).normalize(); // screen right (the camera looks along -w)
  s.look.target.copy(C).addScaledVector(upish, R * 0.72).addScaledVector(right, R * 0.34);
  s.look.fov = 35;
  s.look.fog = 0.01;
  // The silhouette circle: n(ph) are the surface normals on the visible limb.
  const rl = R / D,
    rs = Math.sqrt(1 - rl * rl);
  const limb = (ph: number, inward = 0) =>
    w.clone().multiplyScalar(rl).addScaledVector(upish, rs * Math.cos(ph)).addScaledVector(right, rs * Math.sin(ph)).addScaledVector(w, inward).normalize();
  // The skyline phase: where the limb crosses the terminator (just into night).
  let ph0 = 0,
    best = 1e9;
  for (let i = 0; i < 1440; i++) {
    const ph = (i / 1440) * TAU;
    const n = limb(ph);
    if (n.dot(upish) < 0.3) continue;
    const sc = Math.abs(n.dot(KEY_DIR) + 0.06);
    if (sc < best) {
      best = sc;
      ph0 = ph;
    }
  }
  // Which way along the limb is night.
  const night = limb(ph0 + 0.05).dot(KEY_DIR) < limb(ph0 - 0.05).dot(KEY_DIR) ? 1 : -1;
  const patch = (n: THREE.Vector3): Surface => {
    const e1 = w.clone().cross(n).normalize();
    return { C, R, n0: n, e1, e2: n.clone().cross(e1).normalize() };
  };
  // Screen-ish coordinates on the visible face: c right, b up (in R), the rest toward the eye.
  const face = (c: number, b: number) =>
    right.clone().multiplyScalar(c).addScaledVector(upish, b).addScaledVector(w, Math.sqrt(Math.max(0.02, 1 - c * c - b * b)));
  const rnd = rng(5);
  // Three distinct skylines (the strengthening: larger, more distinct, readable as cities):
  // 1. the capital, standing on the limb at the terminator: tall core and landmarks in silhouette
  //    against the atmosphere, the key light grazing its lit side;
  // 2. a long low city further along the limb into night, a silhouette with lit windows;
  // 3. a city on the night face just inside the terminator, seen from above, its towers catching
  //    the last light.
  const cityA = patch(limb(ph0, 0.08));
  const cityB = patch(limb(ph0 + night * 0.28, 0.12));
  const cityC = patch(face(0.3, 0.14).normalize());
  const skyA = cityCluster(rnd, 0, 0, 0.42, 0.13, 0.3, 120, 0.034);
  skyA.push(
    { type: 'twist', x: 0.04, s: 0, w: 0.042, d: 0.042, h: 0.46, seed: 0.31 },
    { type: 'needle', x: -0.1, s: 0.02, w: 0.028, d: 0.028, h: 0.52, seed: -1 },
    { type: 'drum', x: 0.16, s: -0.01, w: 0.05, d: 0.05, h: 0.36, seed: 0.7 },
    { type: 'setback', x: -0.2, s: 0.01, w: 0.06, d: 0.05, h: 0.3, seed: 0.12 },
    { type: 'dome', x: -0.3, s: 0.0, w: 0.1, d: 0.1, h: 0.055, seed: -1 },
  );
  const skyB = cityCluster(rnd, 0, 0, 0.55, 0.1, 0.18, 90, 0.034);
  skyB.push({ type: 'drum', x: 0.12, s: 0, w: 0.05, d: 0.05, h: 0.26, seed: 0.55 }, { type: 'dome', x: -0.18, s: 0.02, w: 0.12, d: 0.12, h: 0.06, seed: -1 });
  const skyC = cityCluster(rnd, 0, 0, 0.3, 0.24, 0.28, 80, 0.042);
  skyC.push({ type: 'twist', x: 0.02, s: 0.02, w: 0.045, d: 0.045, h: 0.34, seed: 0.44 });
  const cityMat = buildingMaterial(0.32, 0.011);
  const cities = s.keep(new Structures(s.scene, cityMat));
  cities.add(cityA, skyA);
  cities.add(cityB, skyB);
  cities.add(cityC, skyC);
  // Lights in blocks around the three skylines and two towns on the face.
  s.scene.add(
    s.own(
      cityLights(
        C,
        R,
        KEY_DIR,
        [
          { dir: cityA.n0, r: 0.2, gain: 1 },
          { dir: cityB.n0, r: 0.22, gain: 0.9 },
          { dir: cityC.n0, r: 0.17, gain: 1 },
          { dir: limb(ph0 + night * 0.62, 0.55), r: 0.11, gain: 0.7 },
          { dir: limb(ph0 + night * 0.3, 0.9), r: 0.09, gain: 0.6 },
        ],
        2.4,
      ),
    ),
  );
  const beacon = s.glow(WARM.clone().multiplyScalar(1.4), 0.08);
  beacon.position.copy(S(cityA, -0.1, 0.02, 0.55));
  // The formation's pass: low across the night face, over the face city and under the capital.
  const curve = new THREE.CatmullRomCurve3(
    [face(-0.98, 0.1), face(-0.5, 0.18), face(-0.05, 0.2), cityC.n0.clone(), face(0.62, 0.3), face(0.95, 0.42)].map((n, i, all) =>
      n.normalize().multiplyScalar(R + (i === 0 || i === all.length - 1 ? 0.34 : 0.16)),
    ),
  );
  const formation = wedge(s, 0.1, 0.04, 0.014);
  const PERIOD = 14,
    FLY = 7;
  return {
    t0: 1.2,
    poster: 4.0,
    tick(t) {
      planet.update(t, 0, 0, 0.34, 0.25);
      body.uniforms.uSpin.value = 1.1; // the crust is held: the cities stay put
      const k = ((t % PERIOD) + PERIOD) % PERIOD;
      const u = k / FLY;
      formation.set(curve, u, upish, 0.5, u < 1 ? 1 : 1 - ss(FLY, FLY + 3, k));
      beacon.material.opacity = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.6));
    },
  };
};

const BUILDS: Record<CollectionKind, Build> = { portfolio: threeApproaches, playbooks: limbLights };


export function createCollectionScene(
  host: HTMLElement,
  kind: CollectionKind,
  hooks: CollectionHooks,
  /** A fixed clock (seconds, or 'poster' for the settled frame) — used to capture posters. */
  freeze?: number | 'poster',
  /** A reframing for the end band's short, wide landscape (ticket #38): `fovScale` multiplies
   *  the fitted vertical field of view (below 1 moves in); `shiftY` moves the image in NDC
   *  without changing perspective (positive raises the world, so its curve runs along the
   *  frame's lower edge); `shiftX` likewise across (positive moves the world right). */
  view: { fovScale?: number; shiftX?: number; shiftY?: number } = {},
): CollectionHandle {
  // Clear colour calibrated to tone-map onto the page's --ground (see STAGE_GROUND).
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(STAGE_GROUND);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(STAGE_GROUND, 0.018);
  scene.fog = fog;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRoom = new RoomEnvironment();
  const envTex = pmrem.fromScene(envRoom, 0.045).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.42;
  scene.environmentRotation.set(-1.15, 0.4, 0);
  const key = new THREE.DirectionalLight(0xffe2bd, 2.7);
  key.position.copy(KEY_DIR).multiplyScalar(10);
  const fill = new THREE.DirectionalLight(0x93a6b0, 0.6);
  fill.position.copy(FILL_DIR).multiplyScalar(10);
  const rim = new THREE.DirectionalLight(0xff8a45, 2.4);
  rim.position.copy(RIM_DIR).multiplyScalar(10);
  scene.add(key, fill, rim);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 200);
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.34, 0.45, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const feather = new ShaderPass(EdgeFeather);
  composer.addPass(feather);

  // Star dust: a far shell below the bloom threshold (seeded, so posters are repeatable).
  const dust = addStarDust(scene);

  const kit = makeCraftKit(scene, camera);
  const planets: PlanetHandle[] = [];
  const sprites: THREE.SpriteMaterial[] = [];
  const owned: { dispose(): void }[] = [];
  const structures = new Structures(scene, buildingMaterial(0.11, 0.012));
  owned.push(structures);
  const stage: Stage = {
    scene,
    camera,
    kit,
    structures,
    look: { pos: V(0, 0, 10), target: V(), fov: 35, fog: 0.018 },
    own(mesh) {
      owned.push(mesh.geometry, mesh.material as THREE.Material);
      return mesh;
    },
    keep(d) {
      owned.push(d);
      return d;
    },
    planet(r, p) {
      const pl = createPlanet({ radius: r, lights: { key: KEY_DIR, fill: FILL_DIR, rim: RIM_DIR } });
      pl.group.position.copy(p);
      scene.add(pl.group);
      planets.push(pl);
      return pl;
    },
    glow(color, size) {
      const m = new THREE.SpriteMaterial({ map: kit.glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: ADD, fog: false });
      sprites.push(m);
      const sp = new THREE.Sprite(m);
      sp.scale.setScalar(size);
      scene.add(sp);
      return sp;
    },
  };
  const build = BUILDS[kind](stage);
  camera.position.copy(stage.look.pos);
  camera.lookAt(stage.look.target);
  fog.density = stage.look.fog;
  const baseFov = stage.look.fov;

  /* ---- loop: runs only on screen, in a visible tab, unpaused ---- */
  const frozen = freeze === 'poster' ? build.poster : freeze;
  let t = frozen ?? build.t0;
  let raf = 0,
    last = 0,
    running = false,
    onScreen = false,
    hostPaused = false,
    disposed = false,
    ready = false,
    totalFrames = 0,
    diagnosticAt = 0;
  const frameTimes: number[] = [];

  function draw() {
    build.tick(t);
    kit.orientCrafts();
    composer.render();
  }
  /** Longest step a frame may advance the clock (s): a stalled tab resumes, never jumps. */
  const MAX_STEP_S = 0.05;
  /** Frame times kept for the p50/p95 diagnostics. */
  const FRAME_SAMPLES = 240;
  function tick(now: number) {
    raf = 0;
    if (!running || disposed) return;
    const dtMs = now - last;
    last = now;
    if (frozen === undefined) t += Math.min(dtMs / 1000, MAX_STEP_S) || 0;
    draw();
    totalFrames++;
    if (totalFrames > 1) {
      frameTimes.push(dtMs);
      if (frameTimes.length > FRAME_SAMPLES) frameTimes.shift();
    }
    if (now - diagnosticAt > 1000) publish(now);
    if (!ready) {
      ready = true;
      hooks.onReady();
    }
    raf = requestAnimationFrame(tick);
  }
  function publish(now = performance.now()) {
    const times = [...frameTimes].sort((x, y) => x - y);
    const n = times.length;
    host.dataset.frameCount = String(totalFrames);
    host.dataset.frameP50 = (times[Math.floor(n * 0.5)] || 0).toFixed(1);
    host.dataset.frameP95 = (times[Math.floor(n * 0.95)] || 0).toFixed(1);
    host.dataset.frameSamples = String(n);
    host.dataset.simTime = t.toFixed(2);
    host.dataset.scene = kind;
    host.dataset.starCount = String(dust.count);
    diagnosticAt = now;
  }
  function setRunning() {
    const want = onScreen && !document.hidden && !disposed && !hostPaused;
    if (want === running) return;
    running = want;
    if (running) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (!disposed) publish();
    }
  }
  const io = new IntersectionObserver(
    (entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      setRunning();
    },
    { threshold: 0.01 },
  );
  io.observe(host);
  const onVisibility = () => setRunning();
  document.addEventListener('visibilitychange', onVisibility);
  // A lost context cannot be rendered into: stop the loop and mark the scene disposed. The GPU
  // resources went with the context; the owner still calls dispose() to release the rest
  // (listeners, observers, CPU-side geometry). Stop for good; the host swaps to its poster.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    disposed = true;
    setRunning();
    hooks.onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h || disposed) return;
    const pr = renderer.getPixelRatio();
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w * pr, h * pr);
    kit.setResolution(w * pr, h * pr);
    setEdgeFade(feather, w, h, pr);
    camera.aspect = w / h;
    // Keep the study's horizontal extent in narrower boxes (taller desktop stages, phones).
    const k = Math.max(1, DESIGN_ASPECT / camera.aspect) / (camera.aspect < 1.1 ? build.narrowZoom ?? 1 : 1);
    camera.fov = (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) * k) * 180) / Math.PI * (view.fovScale ?? 1);
    camera.updateProjectionMatrix();
    if (view.shiftY || view.shiftX) {
      camera.projectionMatrix.elements[9] = -(view.shiftY ?? 0);
      camera.projectionMatrix.elements[8] = -(view.shiftX ?? 0);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    if (!running) draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  return {
    pause(v) {
      hostPaused = v;
      setRunning();
    },
    resize,
    dispose() {
      disposed = true;
      setRunning();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      planets.forEach((p) => p.dispose());
      owned.forEach((d) => d.dispose());
      sprites.forEach((m) => m.dispose());
      dust.dispose();
      kit.dispose();
      envTex.dispose();
      envRoom.dispose();
      pmrem.dispose();
      // The composer frees only its own two render targets and copy pass: each pass it holds
      // (render, bloom with its targets and materials, output, feather) is released here.
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        /* already lost */
      }
      renderer.domElement.remove();
    },
  };
}
