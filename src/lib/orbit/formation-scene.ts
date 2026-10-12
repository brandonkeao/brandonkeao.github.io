import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPlanet } from './planet';
import { makeCraftKit, RED, IVORY, COPPER_DEEP } from './formation-craft';
import type { EngagementSlug } from './orbit-data';

/**
 * Formation (ticket #13): the engagement story told live over the hero planet.
 *
 * The team is a formation of ivory chevron craft with red motion trails; Brandon is the
 * copper one. The three models differ by where he sits — inside (Full time), alongside
 * (Fractional), above (Advisory) — and every story ends with the team flying down into
 * the planet's atmosphere for its mission. Accepted in Brandon OS
 * `analysis/2026-10-10-imagery-reset/STORY_CONTRACT.md` (study reviews 1–2); this is the
 * study's final choreography, ported verbatim from the scene lab's `formation.html`.
 *
 * One instance drives one model's story. Scroll progress (0..1 across the three copy
 * beats) scrubs the choreography; the host feeds it via `setProgress`. The scene owns a
 * rAF loop that pauses whenever its container is offscreen or the document is hidden,
 * so hidden details and background tabs cost nothing. Red #F16B65 appears only as
 * moving trails; nothing in the imagery is text.
 */

export interface FormationHandle {
  /** Story progress 0..1 (the reading line across the three beats); smoothed internally.
   *  A no-op in the establish view, which holds its own progress. */
  setProgress(p: number): void;
  /** Host-driven hold (the stage's Pause control); offscreen pausing is automatic. */
  pause(v: boolean): void;
  resize(): void;
  dispose(): void;
}

/** 'story' scrubs the three beats by scroll; 'establish' is the selected-state hero shot:
 *  a wider fourth camera on the beat-1 tableau, progress held just past the arrival gates
 *  so the copper craft is present, with the orbit clock free-running. */
export type FormationView = 'story' | 'establish';
const ESTABLISH_P: Record<EngagementSlug, number> = { 'full-time': 0.12, fractional: 0.12, advisory: 0.1 };

/* ---- render profile (map-scene.ts values; the lab's `formation.html` header) ---- */
const KEY_DIR = new THREE.Vector3(-5.2, 3.4, 3.6).normalize();
const FILL_DIR = new THREE.Vector3(4, -2.5, 3).normalize();
const RIM_DIR = new THREE.Vector3(2.6, 1.8, -6).normalize();
const GROUND = 0x0a0b0a;
const COPPER = new THREE.Color(0xf0a468); // the rocket hull's emissive (ticket #10 body)
const PLANET_R = 3.4;

/* ---- maths ---- */
const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Orbital plane: tilted so orbits read as ellipses from the hero-ish vantage.
const PLANE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.38, 0, 0.16));

interface Frame {
  P: THREE.Vector3;
  T: THREE.Vector3;
  N: THREE.Vector3;
  B: THREE.Vector3;
}
/** Orbit frame at angle th, radius r: position, forward T, outward N, plane-normal B. */
function frame(th: number, r: number): Frame {
  const N = V(Math.cos(th), 0, Math.sin(th)).applyQuaternion(PLANE);
  const T = V(-Math.sin(th), 0, Math.cos(th)).applyQuaternion(PLANE);
  const B = V(0, 1, 0).applyQuaternion(PLANE);
  return { P: N.clone().multiplyScalar(r), T, N, B };
}
const at = (f: Frame, a: number, n: number, b: number) =>
  f.P.clone().addScaledVector(f.T, a).addScaledVector(f.N, n).addScaledVector(f.B, b);
/** Camera rig relative to a frame: (a along T, n along N, b along B) from point `o`. */
function rig(f: Frame, o: THREE.Vector3, a: number, n: number, b: number) {
  return o.clone().addScaledVector(f.T, a).addScaledVector(f.N, n).addScaledVector(f.B, b);
}
/** Blend three beat keyframes over p with holds at each beat. */
function beatMix(p: number) {
  const x = clamp(p * 3 - 0.5, 0, 2),
    i = Math.min(Math.floor(x), 1),
    f = ss(0.15, 0.85, x - i);
  return { i, f };
}
/** 0 in open space, 1 deep in the atmosphere's glow (altitude above the surface). */
const heat = (P: THREE.Vector3) => ss(0.55, 0.22, P.length() - PLANET_R);
const HOT = IVORY.clone().lerp(new THREE.Color(0xffe2c4), 0.5);

interface CamKey {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}
interface Story {
  update(p: number, t: number): { K: CamKey[]; up: THREE.Vector3; E: CamKey };
}

export function createFormation(
  container: HTMLElement,
  model: EngagementSlug,
  opts?: { view?: FormationView },
): FormationHandle {
  const view: FormationView = opts?.view ?? 'story';
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(GROUND);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
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

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.34, 0.45, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Star dust: far shell, below the bloom threshold.
  const dust = (() => {
    const n = 900,
      pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 30);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0x8a877d,
      size: 1.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
    return { g, m };
  })();

  // The hero planet, unchanged.
  const planet = createPlanet({ radius: PLANET_R, lights: { key: KEY_DIR, fill: FILL_DIR, rim: RIM_DIR } });
  scene.add(planet.group);

  /* ---- primitives: the shared craft kit, plus this scene's entry sheaths ---- */
  const kit = makeCraftKit(scene, camera);
  const { craft, place, orientCrafts, trail, setTrail, staticLine, glowTex, lineMats } = kit;
  const ADD = THREE.AdditiveBlending;

  /** Hot sheath on the leading edge of a craft entering the atmosphere. */
  function sheath(size = 0.2) {
    const m = new THREE.SpriteMaterial({
      map: glowTex,
      color: HOT.clone().multiplyScalar(1.5),
      transparent: true,
      depthWrite: false,
      blending: ADD,
    });
    const sp = new THREE.Sprite(m);
    sp.userData.size = size;
    sp.visible = false;
    scene.add(sp);
    return sp;
  }
  function setSheath(sp: THREE.Sprite, pts: THREE.Vector3[]) {
    const h = heat(pts[0]);
    sp.visible = h > 0.001;
    sp.material.opacity = 0.7 * h;
    sp.scale.setScalar((sp.userData.size as number) * (0.55 + 0.9 * h));
    sp.position.copy(pts[0]);
    if (pts.length > 1) sp.position.addScaledVector(pts[0].clone().sub(pts[1]).normalize(), 0.025);
    return h;
  }

  /* ---- the three stories (the study's final choreography, verbatim) ---- */
  const PH = [0.3, 1.7, 2.9, 4.1, 5.3];

  function storyFullTime(): Story {
    const R = 5.05,
      W = TAU / 52;
    // Line abreast across the orbit plane; the middle place is empty until the new light takes it.
    const ROW = [
      [-0.05, 0, -0.7],
      [0.03, 0, -0.36],
      [0, 0, 0],
      [0.02, 0, 0.36],
      [-0.04, 0, 0.7],
    ];
    const team = [0, 1, 3, 4].map((i) => ({
      slot: ROW[i],
      light: craft(IVORY, 0.2, 2.2, true),
      tr: trail(1.8),
      sh: sheath(),
      ph: PH[i],
    }));
    const me = { slot: ROW[2], light: craft(COPPER_DEEP, 0.26, 2.9, true), tr: trail(2), sh: sheath() };
    const heading = trail(3.2);
    const offset = (k: (typeof team)[0], s: number, wob: number): [number, number, number] => [
      k.slot[0] + wob * 0.12 * Math.sin(s * 1.1 + k.ph * 2.1),
      k.slot[1] + wob * 0.07 * Math.sin(s * 1.3 + k.ph),
      k.slot[2] + wob * 0.1 * Math.sin(s * 0.9 + k.ph * 1.4),
    ];
    const meOffset = (j: number): [number, number, number] => {
      // quadratic approach from ahead-outward-wide into the empty slot
      const A = [1.25, 1.05, 1.95],
        C = [0.2, 0.85, 1.05],
        S = me.slot,
        e = ss(0, 1, j),
        u = 1 - e;
      return [0, 1, 2].map((q) => u * u * A[q] + 2 * u * e * C[q] + e * e * S[q]) as [number, number, number];
    };
    /** The formation's frame at orbit time s, `tr` (0..1) of the way down from its orbit into
     *  the atmosphere: a steepening swoop that flattens into a shallow glide above the surface. */
    const RE = 3.66;
    const pose = (s: number, tr: number) => {
      const d = ss(0, 1, tr);
      return frame(W * s + 0.5 * d, mix(R, RE, d));
    };
    return {
      update(p, t) {
        // The join lives inside beat 1 (When this fits: the owner arrives), the alignment
        // settles through beat 2, the swoop stays beat 3 (review round 1).
        const join = ss(0.08, 0.34, p),
          align = ss(0.3, 0.5, p),
          turn = ss(0.68, 0.94, p);
        const wob = 1 - align,
          th = W * t;
        const N = 40,
          ds = 0.11 + 0.07 * turn,
          dturn = 0.028; // trails keep the bend they turned through
        const trh = (i: number) => clamp(turn - i * dturn);
        for (const k of team) {
          const pts = [];
          for (let i = 0; i < N; i++) {
            const s = t - i * ds;
            pts.push(at(pose(s, trh(i)), ...offset(k, s, wob)));
          }
          place(k.light, pts);
          const h = setSheath(k.sh, pts);
          // First beat: the team runs dimmer so the copper arrival is the thing you find;
          // at full heat each craft tightens so five lights stay five (review round 1).
          k.light.setOpacity(0.7 + 0.3 * ss(0.22, 0.42, p));
          k.light.group.scale.setScalar(1 - 0.35 * h);
          setTrail(k.tr, pts, RED, (0.75 * (1 - 0.45 * align) + 0.35 * turn) * (1 + 1.4 * h));
        }
        {
          // the new light: its trail walks back along its approach curve while it is still arriving
          const pts = [];
          const back = 0.035 * (1 - ss(0.85, 1, join));
          for (let i = 0; i < N; i++) {
            const s = t - i * ds,
              jj = clamp(join - i * back);
            pts.push(at(pose(s, trh(i)), ...meOffset(jj)));
          }
          place(me.light, pts);
          // In frame and findable from the first frame (the beat is about the arriving owner).
          me.light.setOpacity(0.55 + 0.45 * ss(0, 0.1, p));
          const h = setSheath(me.sh, pts);
          me.light.group.scale.setScalar(1 - 0.35 * h);
          setTrail(me.tr, pts, RED, ss(0, 0.08, p) * (0.8 * (1 - 0.45 * align) + 0.35 * turn) * (1 + 1.4 * h));
        }
        {
          // one shared heading behind the formation's centre once aligned
          const pts = [];
          for (let i = 0; i < 70; i++) {
            const s = t - i * ds;
            pts.push(pose(s, trh(i)).P);
          }
          setTrail(heading, pts, RED, 1.9 * align, 1.1);
        }
        // camera: wide → embedded → ride behind and above as the team swoops into the atmosphere together
        const f = frame(th, R),
          fd = pose(t, turn),
          F = fd.P,
          F0 = f.P;
        const K = [
          // K0 opens on the approach: the copper craft is inside the frame from p = 0.
          { pos: rig(f, F0, -3.6, 2.1, 3.1), look: rig(f, F0, 0.55, 0.12, 0.95), fov: 38 },
          { pos: rig(f, F0, -2.6, 1.3, 1.1), look: rig(f, F0, 0.4, -0.1, 0.1), fov: 33 },
          { pos: rig(fd, F, -3.0, 1.5, 2.4), look: rig(fd, F, 1.4, -0.7, 0.2), fov: 38 },
        ];
        // The establishing shot: the row with its gap and the arriving copper craft, pulled
        // back far enough that the planet's disc grounds the frame.
        const E = { pos: rig(f, F0, -7.0, 3.6, 6.4), look: F0.clone().lerp(V(), 0.55), fov: 44 };
        return { K, up: fd.N, E };
      },
    };
  }

  function storyFractional(): Story {
    const R1 = 4.35,
      R2 = 6.1,
      W = TAU / 60;
    const SL = [
      [0, 0, 0.2],
      [-0.42, 0.04, 0.58],
      [-0.42, -0.04, -0.18],
      [-0.84, 0.06, 0.96],
    ];
    const team = SL.map((slot, i) => ({
      slot,
      light: craft(IVORY, 0.2, 2.2, true),
      tr: trail(1.8),
      sh: sheath(),
      ph: PH[i],
    }));
    // The rocket is Fractional's established body (ticket #10): copper hull, arrives on the wing.
    const rocket = new THREE.Group();
    const rocketMat = new THREE.MeshStandardMaterial({
      color: 0xc98a5a,
      metalness: 0.65,
      roughness: 0.35,
      emissive: COPPER,
      emissiveIntensity: 0.35,
    });
    const rocketGeos = [new THREE.CylinderGeometry(0.034, 0.04, 0.17, 20), new THREE.ConeGeometry(0.034, 0.08, 20)];
    {
      const body = new THREE.Mesh(rocketGeos[0], rocketMat);
      const nose = new THREE.Mesh(rocketGeos[1], rocketMat);
      nose.position.y = 0.125;
      rocket.add(body, nose);
      scene.add(rocket);
    }
    const rocketGlow = craft(COPPER_DEEP, 0.26, 2.8);
    const rocketTr = trail(2.2);
    staticLine(
      Array.from({ length: 181 }, (_, i) => frame((i / 180) * TAU, R2).P),
      0xefe6d2,
      0.16,
      1.2,
      true,
    );
    // One deliberate climb: a single long burn that eases in and settles onto the target orbit.
    const RE = 3.72;
    const rocketOff = (arrive: number, peel: number): [number, number, number] => {
      const a = ss(0, 1, arrive),
        q = ss(0, 1, peel);
      // The peel is a handover, not an exit: he banks up and aside to hold station near the
      // target orbit, still in frame while the team goes on without him (review round 1).
      return [mix(-3.2, -0.15, a) + 1.7 * q, mix(0.9, 0.12, a) + 0.6 * q, mix(-1.6, -0.82, a) - 0.55 * q];
    };
    return {
      update(p, t) {
        const arrive = ss(0.04, 0.26, p),
          climb = ss(0.34, 0.66, p),
          peel = ss(0.7, 0.84, p);
        const entry = ss(0.88, 1.0, p); // after the guide peels off, the team starts down into the atmosphere
        const hist = 1 - ss(0.72, 0.86, p); // trails keep the climb's arc until the new orbit is held
        const th = W * t,
          N = 44,
          ds = 0.12,
          dc = 0.03 * hist,
          de = 0.03;
        const rAt = (c: number) => mix(R1, R2, ss(0, 1, c));
        const rTeam = (c: number, e: number) => mix(rAt(c), RE, ss(0, 1, e) ** 1.4);
        const b = 0.9 * Math.sin(Math.PI * climb); // one steady burn, brightest mid-climb
        for (const k of team) {
          const pts = [];
          for (let i = 0; i < N; i++) {
            const s = t - i * ds,
              c = clamp(climb - i * dc * ss(0.001, 0.02, climb)),
              e = clamp(entry - i * de);
            pts.push(at(frame(W * s + 0.45 * ss(0, 1, e), rTeam(c, e)), k.slot[0], k.slot[1], k.slot[2]));
          }
          place(k.light, pts);
          const h = setSheath(k.sh, pts);
          k.light.setOpacity(0.72 + 0.28 * ss(0.2, 0.4, p));
          k.light.group.scale.setScalar(1 - 0.35 * h);
          setTrail(k.tr, pts, RED, (0.7 + 1.1 * b) * (1 + 1.4 * h));
        }
        {
          // rocket: arrives on the wing, climbs with them, peels away before the entry
          const pts = [];
          // He keeps pace with the team's heading through their entry (the +0.45 angular
          // shift), holding his altitude: above and present while they go in, not gone.
          for (let i = 0; i < N; i++) {
            const s = t - i * ds,
              c = clamp(climb - i * dc * ss(0.001, 0.02, climb)),
              e = clamp(entry - i * de);
            const ar = clamp(arrive - i * 0.03 * (1 - ss(0.9, 1, arrive))),
              pe = clamp(peel - i * 0.03);
            pts.push(at(frame(W * s + 0.45 * ss(0, 1, e), rAt(c)), ...rocketOff(ar, pe)));
          }
          const next = at(frame(W * (t + 0.05) + 0.45 * ss(0, 1, entry), rAt(climb)), ...rocketOff(arrive, clamp(peel + 0.01)));
          rocket.position.copy(pts[0]);
          rocket.quaternion.setFromUnitVectors(V(0, 1, 0), next.clone().sub(pts[0]).normalize());
          rocketGlow.group.position.copy(pts[0]).addScaledVector(next.clone().sub(pts[0]).normalize(), -0.1);
          const vis = ss(0.0, 0.08, p);
          rocket.visible = vis > 0.01;
          rocketGlow.setOpacity(vis);
          setTrail(rocketTr, pts, RED, vis * (0.9 + 1.4 * b));
        }
        for (const m of lineMats)
          if (m.dashed) {
            // The target orbit is beat 2's change: it appears as the climb starts, never before.
            m.opacity = 0.22 * ss(0.03, 0.3, climb) * (1 - 0.45 * peel);
            m.dashOffset = -t * 0.05;
          }
        const r = rTeam(climb, entry),
          f = frame(th + 0.45 * ss(0, 1, entry), r),
          F = at(f, -0.4, 0, 0.2);
        const fMid = frame(th, mix(R1, R2, 0.5));
        const Fm = at(fMid, -0.4, 0, 0.2);
        const K = [
          { pos: rig(f, Fm, -2.2, 1.0, 6.8), look: rig(f, Fm, 0.2, -0.2, 0), fov: 35 },
          { pos: rig(f, Fm, -1.6, 0.6, 7.2), look: rig(f, F, 0.2, 0.4 * (R2 - r), 0.0), fov: 35 },
          { pos: rig(f, F, -4.2, 2.6, 8.2), look: rig(f, F, 1.2, 0.5, 0), fov: 36 },
        ];
        // The establishing shot: the low-orbit team with the rocket on its wing, wide.
        const E = { pos: rig(f, Fm, -4.5, 2.2, 10.5), look: Fm.clone().lerp(V(), 0.5), fov: 42 };
        return { K, up: f.N, E };
      },
    };
  }

  function storyAdvisory(): Story {
    // Everything moves along the orbit together; the camera rides with it.
    const RA = 3.95,
      RE = 3.64,
      W = TAU / 60,
      // Softer loops: busy, not farcical — the friction is the process's, not the team's
      // (review round 1, PM).
      RHO = 0.24,
      OMEGA = 2.4;
    const SL = [
      [0, 0, 0],
      [-0.17, 0.07, 0.12],
      [-0.17, -0.07, -0.12],
      [-0.34, 0, 0],
    ];
    const team = SL.map((slot) => ({
      slot,
      light: craft(IVORY, 0.17, 2.2, true),
      tr: trail(1.8),
      sh: sheath(0.17),
    }));
    const obs = { light: craft(COPPER_DEEP, 0.21, 2.9, true), tr: trail(1.6) };
    const OBS_OFF: [number, number, number] = [0.35, 1.25, 0]; // Brandon: a higher orbit, just ahead, in the same plane
    const sight = trail(1.1),
      plan = trail(1.3);
    /** Formation centre at orbit time s. `go` straightens the loops (0 = circling, 1 = clean);
     *  `dv` takes it down into the atmosphere. Returns the local frame too. */
    const centre = (s: number, go: number, dv: number) => {
      const d = ss(0, 1, dv),
        f = frame(W * s + 0.45 * d, mix(RA, RE, d));
      const amt = RHO * (1 - ss(0, 1, go)),
        ph = OMEGA * s;
      return { f, P: at(f, amt * Math.sin(ph), amt * (1 - Math.cos(ph)), 0) }; // loop-the-loops: busy, going in circles
    };
    return {
      update(p, t) {
        const scan = ss(0.28, 0.46, p),
          draw = ss(0.44, 0.62, p);
        const go = ss(0.58, 0.76, p),
          dive = ss(0.72, 0.98, p);
        const N = 90,
          ds = 0.05,
          dg = 0.01;
        const hist = (i: number) => [clamp(go - i * dg), clamp(dive - i * dg)];
        for (const k of team) {
          const pts = [];
          for (let i = 0; i < N; i++) {
            const s = t - i * ds,
              [g, d] = hist(i),
              c = centre(s, g, d),
              c2 = centre(s + 0.01, g, d);
            const T = c2.P.clone().sub(c.P).normalize(),
              Nv = c.P.clone().normalize(),
              Bv = T.clone().cross(Nv).normalize();
            pts.push(
              c.P.clone().addScaledVector(T, k.slot[0]).addScaledVector(Nv, k.slot[1]).addScaledVector(Bv, k.slot[2]),
            );
          }
          place(k.light, pts);
          const h = setSheath(k.sh, pts);
          k.light.setOpacity(0.72 + 0.28 * ss(0.2, 0.4, p));
          k.light.group.scale.setScalar(1 - 0.35 * h);
          setTrail(k.tr, pts, RED, 0.85 * (1 + 1.4 * h));
        }
        // Brandon stays in high orbit throughout, on his own steady trail
        const f = frame(W * t, RA),
          O = at(f, ...OBS_OFF);
        {
          const pts = [];
          for (let i = 0; i < 40; i++) pts.push(at(frame(W * (t - i * 0.12), RA), ...OBS_OFF));
          place(obs.light, pts);
          setTrail(obs.tr, pts, RED, 0.7);
        }
        // the perspective: a sight line down to the team, then a clean line ahead of them, drawn on
        const head = centre(t, go, dive),
          mid = head.P;
        // The sight line thins but never leaves: through the final hold it still points at
        // the team it is checking on (review round 1 — "whether the work helped").
        const look = scan * (1 - 0.72 * ss(0.66, 0.8, p));
        {
          const pts = [];
          for (let i = 0; i <= 24; i++) pts.push(O.clone().lerp(mid, i / 24));
          setTrail(sight, pts.reverse(), IVORY, 0.55 * look, 0.2);
        }
        {
          const pts = [],
            A = 0.9 * draw,
            r0 = head.f.P.length(),
            a0 = W * t + 0.45 * ss(0, 1, dive);
          for (let i = 0; i <= 40; i++) {
            const a = (A * i) / 40;
            pts.push(frame(a0 + a, mix(r0, RE, ss(0, 0.9, a))).P);
          }
          setTrail(plan, pts.reverse(), IVORY, 0.7 * draw * (1 - ss(0.86, 1, p)), 0.25);
        }
        const C = f.P,
          f3 = frame(W * t + 0.3, mix(RA, RE, 0.5));
        const K = [
          { pos: rig(f, C, -0.7, 0.9, 4.6), look: rig(f, C, -0.5, 0.75, 0), fov: 36 },
          { pos: rig(f, C, -0.3, 0.8, 3.6), look: rig(f, C, -0.2, 0.62, 0), fov: 34 },
          // held still: the team visibly drops into the glow
          { pos: rig(f3, f3.P, -0.2, 0.8, 4.6), look: rig(f3, f3.P, 0.05, 0.4, 0), fov: 38 },
        ];
        // The establishing shot: the looping team under the high copper observer, wide.
        const E = { pos: rig(f, C, -1.6, 2.0, 8.6), look: C.clone().lerp(V(), 0.5), fov: 42 };
        return { K, up: head.f.N, E };
      },
    };
  }

  const story: Story =
    model === 'full-time' ? storyFullTime() : model === 'fractional' ? storyFractional() : storyAdvisory();

  /* ---- loop: runs only while the container is on screen and the tab is visible ---- */
  let raf = 0;
  let running = false;
  let onScreen = false;
  let disposed = false;
  let t = 24; // the study's reference clock start; advanced only while running
  let last = 0;
  let hostPaused = false;
  let pTarget = view === 'establish' ? ESTABLISH_P[model] : 0,
    pS = 0,
    first = true;
  const camPos = V(),
    camLook = V();

  function tick(now: number) {
    raf = 0;
    if (!running || disposed) return;
    const dt = Math.min((now - last) / 1000, 0.05) || 0;
    last = now;
    t += dt;
    pS = first ? pTarget : pS + (pTarget - pS) * (1 - Math.exp(-dt / 0.14));
    planet.update(t, 0, 0, 1, 0.45);
    const { K, up, E } = story.update(pS, t);
    let pos: THREE.Vector3, look: THREE.Vector3, fov: number;
    if (view === 'establish') {
      // One wide rig, recomputed each frame so the camera rides the free-running orbit.
      pos = E.pos;
      look = E.look;
      fov = E.fov;
    } else {
      const { i, f } = beatMix(pS);
      pos = K[i].pos.clone().lerp(K[i + 1].pos, f);
      look = K[i].look.clone().lerp(K[i + 1].look, f);
      fov = mix(K[i].fov, K[i + 1].fov, f);
    }
    const k = first ? 1 : 1 - Math.exp(-dt / 0.18);
    camPos.lerp(pos, k);
    camLook.lerp(look, k);
    first = false;
    camera.position.copy(camPos);
    camera.up.copy(up);
    camera.lookAt(camLook);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    orientCrafts();
    composer.render();
    raf = requestAnimationFrame(tick);
  }
  function setRunning() {
    const want = onScreen && !document.hidden && !disposed && !hostPaused;
    if (want === running) return;
    running = want;
    if (running) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    setRunning();
  });
  io.observe(container);
  const onVisibility = () => setRunning();
  document.addEventListener('visibilitychange', onVisibility);
  // A lost context cannot be rendered into: stop for good (the host swaps to its poster).
  const onContextLost = (e: Event) => {
    e.preventDefault();
    disposed = true;
    setRunning();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w * pr, h * pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    kit.setResolution(w * pr, h * pr);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  return {
    setProgress(p) {
      if (view === 'story') pTarget = clamp(p);
    },
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
      scene.traverse((n) => {
        const o = n as THREE.Mesh;
        if (o.geometry) o.geometry.dispose();
        const m = (o as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      planet.dispose();
      dust.g.dispose();
      dust.m.dispose();
      kit.dispose();
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      // Release the GPU context now rather than when the GC finds it: a services visit can
      // otherwise hold four live contexts and evict the oldest page's (#13 review).
      try { renderer.forceContextLoss(); } catch { /* already lost */ }
      renderer.domElement.remove();
    },
  };
}
