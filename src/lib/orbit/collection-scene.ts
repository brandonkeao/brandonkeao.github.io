import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPlanet, type Planet as PlanetHandle } from './planet';
import { STAGE_GROUND } from './moon-surfaces';
import { makeCraftKit, RED, IVORY, COPPER_DEEP, type CraftKit } from './formation-craft';

/**
 * Collection heroes (ticket #16): the decorative stages beside the Portfolio and Playbooks
 * titles. Brandon picked them from the six concept studies (Brandon OS
 * `analysis/2026-10-12-collection-hero-concepts/`, DECISIONS "October 12 (late, 2)"):
 *
 * - `portfolio` — P1 Flight record: red trails of missions already flown sweep in over the
 *   planet; one four-craft wedge (copper inside ivory) dives into the atmosphere each cycle,
 *   and its trail stays as a fading record (the latest three show).
 * - `playbooks` — K1 Maneuver: a small planet, two faint ivory orbits and a dashed planned
 *   route; a copper craft flies the route, then an ivory craft repeats it. Red only as the
 *   burns at the two route changes and the ivory craft's trail.
 *
 * Both are decorative, not relational (D2): nothing links a case to a method or either to a
 * model; red #F16B65 appears only as motion or trace; no text. Ported from the lab's
 * `concepts.ts` with two settled points (AI-made, reversible):
 * - Edges: a final feather pass blends the outer frame to the exact page ground (43,45,41),
 *   so bloom, the planet corona and the star dust never tint the stage box's edge.
 * - Speeds ("varied but matched", DECISIONS line 125): the Playbooks craft circle the inner
 *   orbit in 12 s, the Home/Work with me inner moon's lap at the site's 2x; the Portfolio
 *   wedge dives once per 12 s (the study's 9.5 s left 1.5 s between dives and read busy).
 *
 * Conventions follow formation-scene.ts / map-scene.ts: one WebGLRenderer, the shared render
 * profile, STAGE_GROUND clear colour, a loop that runs only on screen in a visible tab and
 * unpaused, a context-loss guard (the host swaps to its poster), dispose(), and frame
 * diagnostics on the host's dataset.
 */

export type CollectionKind = 'portfolio' | 'playbooks';

export interface CollectionHooks {
  onReady(): void;
  onFailure(): void;
}

export interface CollectionHandle {
  /** Host-driven hold (the stage's pause chip); offscreen pausing is automatic. */
  pause(v: boolean): void;
  resize(): void;
  dispose(): void;
}

/* ---- render profile (map-scene.ts values) ---- */
const KEY_DIR = new THREE.Vector3(-5.2, 3.4, 3.6).normalize();
const FILL_DIR = new THREE.Vector3(4, -2.5, 3).normalize();
const RIM_DIR = new THREE.Vector3(2.6, 1.8, -6).normalize();
const ADD = THREE.AdditiveBlending;
/** The page ground in output (sRGB) space: what STAGE_GROUND tone-maps to, pixel-exact. */
const GROUND_OUT = new THREE.Vector3(43 / 255, 45 / 255, 41 / 255);
/** The studies were framed for a 760×520 stage; narrower boxes keep that horizontal extent. */
const DESIGN_ASPECT = 760 / 520;
const BASE_FOV = 35;

/* ---- maths ---- */
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Great-circle slerp between two unit directions. */
function slerpDir(a: THREE.Vector3, b: THREE.Vector3, u: number) {
  const om = Math.acos(clamp(a.dot(b), -1, 1));
  if (om < 1e-5) return a.clone();
  const s = Math.sin(om);
  return a.clone().multiplyScalar(Math.sin((1 - u) * om) / s).addScaledVector(b, Math.sin(u * om) / s).normalize();
}

/** Final pass: the outer frame blends to the page ground (hard 10px, soft 40px, CSS px). */
const EdgeFeather = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uHard: { value: 10 },
    uSoft: { value: 40 },
    uGround: { value: GROUND_OUT },
  },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform vec2 uRes;uniform float uHard;uniform float uSoft;uniform vec3 uGround;varying vec2 vUv;
  void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 px=vUv*uRes;float d=min(min(px.x,uRes.x-px.x),min(px.y,uRes.y-px.y));
  float k=smoothstep(uHard,uHard+uSoft,d);gl_FragColor=vec4(mix(uGround,c.rgb,k),1.);}`,
};

interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  kit: CraftKit;
  planet(r: number, pos: THREE.Vector3): PlanetHandle;
  glow(color: THREE.Color, size: number): THREE.Sprite;
  /** Camera position and target, as framed in the study. */
  look: { pos: THREE.Vector3; target: THREE.Vector3 };
}
type Build = (s: Stage) => { tick(t: number): void; t0: number; poster: number };

/** A formation: lead + wingmen, offsets (along, side) in units of the craft spacing. */
const WEDGE: [number, number][] = [[0, 0], [-1, -1], [-1, 1], [-2, 0]];

/** P1 Flight record (Portfolio). */
const flightRecord: Build = (s) => {
  const R = 1.9,
    C = V(2.0, -1.05, -1.2);
  const planet = s.planet(R, C);
  s.look.pos.set(-0.4, 1.0, 10.5);
  s.look.target.set(0.3, -0.15, 0);
  // Mission templates: start/end directions (from C), altitudes. Each ends low, in the atmosphere.
  const T = [
    { a: V(-1, 0.3, 0.1), b: V(0.15, 0.7, 0.7), h0: 3.4, h1: 0.08 },
    { a: V(-0.7, 0.75, -0.1), b: V(0.6, 0.5, 0.62), h0: 2.6, h1: 0.07 },
    { a: V(-1, -0.05, 0.4), b: V(-0.2, 0.45, 0.87), h0: 3.8, h1: 0.08 },
    { a: V(-0.9, 0.5, 0.35), b: V(0.55, 0.75, 0.35), h0: 2.9, h1: 0.08 },
  ].map((m) => ({ ...m, a: m.a.normalize(), b: m.b.normalize() }));
  const PERIOD = 12,
    FLY = 8,
    SP = 0.075;
  function pos(m: (typeof T)[0], u: number, along: number, side: number) {
    const uu = clamp(u + along * 0.012);
    const d = slerpDir(m.a, m.b, uu);
    const alt = mix(m.h0, m.h1, 1 - (1 - uu) ** 2.2);
    const P = C.clone().addScaledVector(d, R + alt);
    const n = m.a.clone().cross(m.b).normalize();
    return P.addScaledVector(n, side * SP);
  }
  // Per slot (mission k mod 4): 4 craft + 4 trails. Records reuse the trails of their slot.
  const slots = T.map(() => ({
    craft: WEDGE.map((_, i) => s.kit.craft(i === 3 ? COPPER_DEEP : IVORY, 0.24, i === 3 ? 1.6 : 1.45, true)),
    trails: WEDGE.map(() => s.kit.trail(1.6)),
  }));
  const N = 64;
  const pts: THREE.Vector3[] = Array.from({ length: N + 1 }, () => V());
  return {
    t0: 3 * PERIOD + 3.5,
    poster: 3 * PERIOD + 5,
    tick(t) {
      planet.update(t, 0, 0, 1, 1);
      const kNow = Math.floor(t / PERIOD);
      for (let j = 0; j < 4; j++) {
        // slot j shows mission k where k ≡ j (mod 4) and k ≤ kNow, the most recent one
        const k = kNow - (((kNow - j) % 4) + 4) % 4;
        const age = kNow - k; // 0 = live
        const m = T[j],
          sl = slots[j];
        const u = age === 0 ? clamp((t - k * PERIOD) / FLY) : 1;
        const fade = age === 0 ? 1 : age === 3 ? (1 - clamp((t - kNow * PERIOD) / 3)) * 0.18 : [1, 0.55, 0.32][age];
        const live = age === 0 && u < 1;
        WEDGE.forEach(([al, sd], i) => {
          for (let q = 0; q <= N; q++) pts[q] = pos(m, u * (1 - q / N), al, sd);
          s.kit.place(sl.craft[i], [pos(m, u, al, sd), pos(m, u - 0.01, al, sd)]);
          const op = live ? ss(0, 0.06, u) * (1 - ss(0.86, 0.99, u)) : 0;
          sl.craft[i].setOpacity(op);
          sl.craft[i].group.visible = op > 0.01;
          const g =
            (age === 0 ? (live ? 0.95 : mix(0.95, 0.55, clamp((t - k * PERIOD - FLY) / 1.5))) : 0.55 * fade) *
            (i === 3 ? 1 : 0.8);
          s.kit.setTrail(sl.trails[i], u > 0.002 ? pts : [], i === 3 ? COPPER_DEEP : RED, age === 0 ? g : g * fade, live ? 1.1 : 0.35);
        });
      }
    },
  };
};

/** K1 Maneuver (Playbooks). */
const maneuver: Build = (s) => {
  const PLANE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, 0.14));
  const O = V(-0.3, -0.2, 0),
    r1 = 1.75,
    r2 = 3.45;
  const inPlane = (th: number, r: number) => V(Math.cos(th) * r, 0, Math.sin(th) * r).applyQuaternion(PLANE).add(O);
  const planet = s.planet(0.95, O);
  s.look.pos.set(0.4, 2.2, 11.4);
  s.look.target.set(-0.1, -0.35, 0);
  const ring = (r: number) => Array.from({ length: 181 }, (_, j) => inPlane((j / 180) * TAU, r));
  s.kit.staticLine(ring(r1), 0xefe6d2, 0.2, 1);
  s.kit.staticLine(ring(r2), 0xefe6d2, 0.2, 1);
  const a = (r1 + r2) / 2,
    e = (r2 - r1) / (r2 + r1),
    PERI = 2.55; // periapsis angle
  const ell = (nu: number) => inPlane(PERI + nu, (a * (1 - e * e)) / (1 + e * Math.cos(nu)));
  s.kit.staticLine(Array.from({ length: 91 }, (_, j) => ell((j / 90) * Math.PI)), 0xefe6d2, 0.42, 1.1, true);
  // One craft's timeline (seconds into its cycle): inner approach → transfer → outer coast.
  // The inner orbit's angular speed is the Home inner moon's 12 s lap (the matched-speeds rule).
  const IN = 2.4,
    TR = 4.2,
    OUT = 4.6,
    CYC = 16;
  const w1 = TAU / 12,
    w2 = w1 * Math.pow(r1 / r2, 1.5);
  const tq = Math.sqrt((1 + e) / (1 - e));
  function at(sx: number) {
    if (sx < IN) return inPlane(PERI - (IN - sx) * w1, r1);
    if (sx < IN + TR) {
      const E = Math.PI * ((sx - IN) / TR);
      const nu = 2 * Math.atan(tq * Math.tan(Math.min(E, Math.PI - 1e-4) / 2));
      return ell(nu < 0 ? nu + TAU : nu);
    }
    return inPlane(PERI + Math.PI + (sx - IN - TR) * w2 * 1.6, r2);
  }
  // The copper craft flies the route; half a cycle later the ivory craft repeats it.
  const fliers = [COPPER_DEEP, IVORY].map((c, i) => ({
    c: s.kit.craft(c, 0.24, i === 0 ? 1.9 : 1.8, true),
    tr: s.kit.trail(i === 0 ? 1.9 : 1.6),
    copper: i === 0,
    burn: s.glow(RED.clone().multiplyScalar(1.6), 0.55),
    off: i * (CYC / 2),
  }));
  const pts: THREE.Vector3[] = [];
  return {
    t0: 6.2,
    poster: 7.5,
    tick(t) {
      planet.update(t, 0, 0, 1, 1);
      for (const f of fliers) {
        const sx = (((t - f.off) % CYC) + CYC) % CYC;
        const op = ss(0, 0.8, sx) * (1 - ss(IN + TR + OUT - 1.2, IN + TR + OUT, sx));
        const p = at(sx);
        s.kit.place(f.c, [p, at(Math.max(0, sx - 0.03))]);
        f.c.setOpacity(op);
        f.c.group.visible = op > 0.01;
        pts.length = 0;
        for (let q = 0; q <= 40; q++) {
          const x = sx - q * 0.05;
          if (x < 0) break;
          pts.push(at(x));
        }
        const inTransfer = sx > IN - 0.3 && sx < IN + TR + 0.8;
        s.kit.setTrail(f.tr, pts, f.copper ? COPPER_DEEP : RED, op * (inTransfer ? 0.95 : 0.55), 1.2);
        const b = Math.max(Math.exp(-(((sx - IN) / 0.35) ** 2)), Math.exp(-(((sx - IN - TR) / 0.35) ** 2)));
        f.burn.position.copy(p);
        f.burn.material.opacity = b * op * 0.9;
      }
    },
  };
};

const BUILDS: Record<CollectionKind, Build> = { portfolio: flightRecord, playbooks: maneuver };

export function createCollectionScene(
  host: HTMLElement,
  kind: CollectionKind,
  hooks: CollectionHooks,
  /** A fixed clock (seconds, or 'poster' for the settled frame) — used to capture posters. */
  freeze?: number | 'poster',
): CollectionHandle {
  // Clear colour calibrated to tone-map onto the page's --ground (see STAGE_GROUND).
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(STAGE_GROUND);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(STAGE_GROUND, 0.018);
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

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 200);
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
  const dust = (() => {
    const n = 900,
      pos = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const v = V(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(60 + rnd() * 30);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0x8a877d, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false, fog: false,
    });
    scene.add(new THREE.Points(g, m));
    return { g, m };
  })();

  const kit = makeCraftKit(scene, camera);
  const planets: PlanetHandle[] = [];
  const sprites: THREE.SpriteMaterial[] = [];
  const stage: Stage = {
    scene,
    camera,
    kit,
    look: { pos: V(0, 0, 10), target: V() },
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
  function tick(now: number) {
    raf = 0;
    if (!running || disposed) return;
    const dtMs = now - last;
    last = now;
    if (frozen === undefined) t += Math.min(dtMs / 1000, 0.05) || 0;
    draw();
    totalFrames++;
    if (totalFrames > 1) {
      frameTimes.push(dtMs);
      if (frameTimes.length > 240) frameTimes.shift();
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
  // A lost context cannot be rendered into: stop for good; the host swaps to its poster.
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
    feather.uniforms.uRes.value.set(w * pr, h * pr);
    feather.uniforms.uHard.value = 10 * pr;
    feather.uniforms.uSoft.value = 40 * pr;
    camera.aspect = w / h;
    // Keep the study's horizontal extent in narrower boxes (taller desktop stages, phones).
    const k = Math.max(1, DESIGN_ASPECT / camera.aspect);
    camera.fov = (2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * k) * 180) / Math.PI;
    camera.updateProjectionMatrix();
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
      sprites.forEach((m) => m.dispose());
      dust.g.dispose();
      dust.m.dispose();
      kit.dispose();
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      feather.dispose();
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
