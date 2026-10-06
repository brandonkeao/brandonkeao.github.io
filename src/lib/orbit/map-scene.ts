import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CATEGORIES, type CategoryId, type ContentItem } from './orbit-data';
import {
  overviewOrbits,
  layoutFor,
  cornerScale,
  CHILD_ORBITS,
  CENTER_SCALES,
  BODY_RADII,
  CHILD_SCALE,
  MOON_SCALE,
  PLANET_RADIUS,
  FOV_Y,
  overviewPose,
  collectionPose,
  cameraPosition,
  stageReserve,
  orbitPosition,
  depthScale,
  ease,
  type Orbit,
  type Pose,
} from './orbits';
import { labelBounds, placeLabel, type Rect } from './label-layout';
import { createPlanet } from './planet';
import { resolveMoonStyle, SPHERE_RADII, SPHERE_CENTER_RADII } from './moon-style';
import { surfaceMaterial, type SurfaceUniforms } from './moon-surfaces';

/**
 * The renderer no longer decides navigation. The host owns a `lib/map-state`
 * machine, asks the renderer to `enter`/`leave` with a token, and advances the
 * machine when the renderer echoes that token through `onSettled`.
 */
export type Hooks = {
  /** Label or mesh click in the overview. The renderer does not self-select. */
  onCategoryRequest(id: CategoryId): void;
  onItem(item: ContentItem): void;
  /** Echoes the token of the enter/leave that finished. */
  onSettled(token: number): void;
  /** Document visible and stage on screen, deduplicated. */
  onVisibility(visible: boolean): void;
  onReady(): void;
  onFailure(): void;
};
export type TransitionOptions = { token: number; instant: boolean };
export type MapController = {
  /** Fly `id` into the centre. Overview positions derive from `phase`. */
  enter(id: CategoryId, o: TransitionOptions & { phase: number }): void;
  /** Fly back to the overview from the current blend. */
  leave(o: TransitionOptions): void;
  showChildren(): void;
  hideChildren(): void;
  /** Set the overview clock (simulation time) to a snapshotted phase. */
  restorePhase(phase: number): void;
  /** Finish the running transition now and settle synchronously. */
  completeTransition(): void;
  /** Current overview clock. */
  getPhase(): number;
  /** Speech envelope 0..1, already smoothed by `lib/narration`. */
  setEnvelope(value: number): void;
  pause(value: boolean): void;
  hold(value: boolean): void;
  reduceMotion(value: boolean): void;
  setFallback(value: boolean): void;
  setPending(value: boolean): void;
  setEmpty(value: boolean): void;
  emphasize(id: CategoryId | null): void;
  dispose(): void;
};

// One key, one fill, one warm rim. Directions point from the origin to the light.
const KEY_DIR = new THREE.Vector3(-5.2, 3.4, 3.6).normalize();
const FILL_DIR = new THREE.Vector3(4, -2.5, 3).normalize();
const RIM_DIR = new THREE.Vector3(2.6, 1.8, -6).normalize();

// Central planet body + corona live in lib/planet.ts (createPlanet).

/**
 * Orbit trace as a real 3D tube. The geometry is a unit-radius TubeGeometry,
 * so `position - normal` recovers the centreline; the shader re-inflates it to
 * a pixel-true radius that grows on the near side (about 2.2 px) and thins on
 * the far side (about 0.9 px). Depth-tested against the planet, additive,
 * brighter in front, soft at the silhouette, and stronger just behind its body.
 */
function traceMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xd08a52) },
      uOpacity: { value: opacity },
      uBody: { value: new THREE.Vector3() },
      uNear: { value: 8 },
      uFar: { value: 16 },
      uBoost: { value: 0 },
      uScale: { value: 1 },
      uPx: { value: 0.001 },
    },
    vertexShader: `uniform vec3 uBody;uniform float uOpacity;uniform float uNear;uniform float uFar;uniform float uBoost;uniform float uScale;uniform float uPx;varying float vA;varying float vEdge;
    void main(){vec4 c=modelMatrix*vec4(position-normal,1.);vec4 mc=viewMatrix*c;float depth=-mc.z;
    float front=1.-smoothstep(uNear,uFar,depth);
    vec3 n=normalize(mat3(modelMatrix)*normal);
    vec4 mv=viewMatrix*vec4(c.xyz+n*uPx*depth*mix(.45,1.25,front),1.);
    vEdge=abs(dot(normalize(mat3(viewMatrix)*n),normalize(-mv.xyz)));
    float b=distance(c.xyz,uBody)/uScale;float near=exp(-b*b*.9);
    vA=uOpacity*((.16+.84*front*front)*(1.+uBoost)+near*.75);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 uColor;varying float vA;varying float vEdge;void main(){float soft=smoothstep(0.,.55,vEdge);gl_FragColor=vec4(uColor*min(vA,.95)*soft,1.);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Planets sit on top of orbit lines (Brandon, 2026-10-06). three.js draws opaque objects
 * before transparent ones whatever their renderOrder, so a body joins the transparent pass
 * (still fully opaque and depth-writing) and sorts after the traces (2) and dust (3).
 * Additive glows keep their own order.
 */
function drawOverTraces(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (!m || Array.isArray(m) || m.blending === THREE.AdditiveBlending) return;
    m.transparent = true;
    o.renderOrder = 4;
  });
}

/**
 * Dust wake: fine points strung along the last ~12% of a moon's own orbit,
 * fading with age. Positions are written on the CPU each frame from the same
 * Kepler clock; `age` (0 at the body, 1 at the tail) and `glint` are static.
 */
function wakeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xe39a5f) },
      uAlpha: { value: 0.5 },
      uSize: { value: 2 },
    },
    vertexShader: `attribute float age;attribute float glint;uniform float uSize;varying float vA;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=uSize*(1.25-.6*age)*(.7+.6*glint)*(14./max(-mv.z,1.));
    vA=pow(1.-age,1.6)*(.35+.65*glint);}`,
    fragmentShader: `uniform vec3 uColor;uniform float uAlpha;varying float vA;
    void main(){vec2 q=gl_PointCoord*2.-1.;float d=dot(q,q);if(d>1.)discard;gl_FragColor=vec4(uColor*vA*uAlpha*(1.-d),1.);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Faint route from the current centre toward the world an answer points to. */
function pathMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uFlow: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: `attribute float t;varying float vT;void main(){vT=t;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uFlow;uniform float uAlpha;varying float vT;void main(){float dash=smoothstep(.35,.5,fract(vT*16.-uFlow))*smoothstep(1.,.85,fract(vT*16.-uFlow));float fade=smoothstep(0.,.12,vT)*smoothstep(1.,.8,vT);gl_FragColor=vec4(vec3(1.,.55,.25),uAlpha*fade*(.35+.65*dash));}`,
    transparent: true,
    depthWrite: false,
  });
}

// ---- Procedural textures (no external assets) -----------------------------
function valueNoise(seed: number) {
  const h = (x: number, y: number, z: number) => {
    let n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      zi = Math.floor(z);
    const fx = s(x - xi),
      fy = s(y - yi),
      fz = s(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) =>
      h(xi + dx, yi + dy, zi + dz);
    return l(
      l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
      l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
      fz,
    );
  };
}
function dataTexture(w: number, h: number, fn: (u: number, v: number) => number) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = Math.max(0, Math.min(255, Math.round(fn(x / w, y / h) * 255)));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = k;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, w, h);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
/** Brushed graphite: fine streaks along one axis, used as roughness. */
function brushedTexture() {
  const n = valueNoise(17);
  return dataTexture(256, 256, (u, v) => {
    const streak = n(u * 3, v * 180, 0.5) * 0.6 + n(u * 9, v * 420, 3.1) * 0.4;
    return 0.34 + streak * 0.3;
  });
}
/** Rust: seamless spherical fbm sampled on the unit sphere (equirect UVs). */
function rustTexture() {
  const n = valueNoise(91);
  return dataTexture(512, 256, (u, v) => {
    const th = u * Math.PI * 2,
      ph = v * Math.PI;
    const x = Math.sin(ph) * Math.cos(th),
      y = Math.cos(ph),
      z = Math.sin(ph) * Math.sin(th);
    let a = 0.5,
      f = 4,
      s = 0;
    for (let i = 0; i < 5; i++) {
      s += a * n(x * f + 11, y * f + 3, z * f + 7);
      f *= 2.1;
      a *= 0.5;
    }
    return Math.min(1, Math.max(0, (s - 0.5) * 1.8 + 0.5));
  });
}

export function createMap(host: HTMLElement, hooks: Hooks, clearColor = 0x0a0b0a): MapController {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(clearColor);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d110c, 0.018);
  const environmentRoom = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentRoom, 0.045);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.42;
  // The camera now looks down on the bodies; tip the room's ceiling panels
  // behind the scene so flat metal faces do not mirror them to white.
  scene.environmentRotation.set(-1.15, 0.4, 0);
  environmentRoom.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(FOV_Y, 1, 0.1, 120);
  // Multisampled targets: the post chain otherwise drops the canvas MSAA and
  // pixel-thin orbit tubes shimmer.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(800, 600, { type: THREE.HalfFloatType, samples: 4 }),
  );
  composer.addPass(new RenderPass(scene, camera));
  // A high threshold keeps glow on the planet's corona and hottest fissures;
  // orbit tubes (capped below it in traceMaterial) and moon edges stay crisp.
  const bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.34, 0.45, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const key = new THREE.DirectionalLight(0xffe2bd, 2.7);
  key.position.copy(KEY_DIR).multiplyScalar(10);
  // Low cool fill from lower right; warm copper rim from behind right so
  // moon limbs and cube edges catch light against the dark.
  // The fill is strong enough to separate the cube's and octahedron's shadow
  // faces from the background, and only faintly cool so it never reads blue.
  const fill = new THREE.DirectionalLight(0x93a6b0, 0.6);
  fill.position.copy(FILL_DIR).multiplyScalar(10);
  const rim = new THREE.DirectionalLight(0xff8a45, 2.4);
  rim.position.copy(RIM_DIR).multiplyScalar(10);
  scene.add(key, fill, rim);

  const planetBody = createPlanet({
    radius: PLANET_RADIUS,
    lights: { key: KEY_DIR, fill: FILL_DIR, rim: RIM_DIR },
  });
  const planet = planetBody.body;
  const atmosphere = planetBody.glow;
  drawOverTraces(planet);
  scene.add(planetBody.group);
  let planetT = 0;


  const brushed = brushedTexture(),
    rust = rustTexture();
  // Moon style (review switch, lib/moon-style.ts). `shapes` keeps the
  // accepted radii and centre scales exactly; `spheres` resizes Portfolio and
  // Approach and fits their centred size; Playbooks is identical in all three.
  const moonStyle = resolveMoonStyle();
  host.dataset.moons = moonStyle;
  // Spheres pack tighter around the planet than the cube and octahedron do
  // (lib/orbits.ts layouts); the camera fit follows the same layout.
  const layout = layoutFor(moonStyle);
  const ORBITS = overviewOrbits(layout);
  const CORNER = cornerScale(layout);
  const RADII =
    moonStyle === 'spheres'
      ? BODY_RADII.map((r, i) => (i === 1 ? r : SPHERE_RADII[i] * MOON_SCALE))
      : BODY_RADII;
  const CENTER =
    moonStyle === 'spheres'
      ? CENTER_SCALES.map((c, i) => (i === 1 ? c : SPHERE_CENTER_RADII[i] / RADII[i]))
      : CENTER_SCALES;
  const edgeMaterials: THREE.LineBasicMaterial[] = [];
  function edges(geometry: THREE.BufferGeometry, opacity: number) {
    const material = new THREE.LineBasicMaterial({
      color: 0xe0955a,
      transparent: true,
      opacity,
    });
    edgeMaterials.push(material);
    return new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), material);
  }
  /** The Playbooks rust moon: identical in every moon style. */
  function rustMoon(s: number) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.29 * s, 64, 48),
      new THREE.MeshPhysicalMaterial({
        color: 0x6c2d17,
        metalness: 0.1,
        roughness: 0.66,
        roughnessMap: rust,
        bumpMap: rust,
        bumpScale: 3,
        clearcoat: 0.08,
        clearcoatRoughness: 0.6,
        emissive: 0x8b3512,
        emissiveIntensity: 0,
      }),
    );
  }
  /** `spheres` and `detailed` styles; `shapes` falls through to the original body. */
  function styledBody(index: number, s: number): THREE.Mesh | null {
    if (index === 1 || moonStyle === 'shapes') return null;
    if (moonStyle === 'spheres') {
      const r = SPHERE_RADII[index] * s;
      return new THREE.Mesh(
        new THREE.SphereGeometry(r, 96, 64),
        index === 0
          ? surfaceMaterial('basalt', r, {
              clearcoat: 0.12,
              clearcoatRoughness: 0.45,
              emissive: 0x8b3512,
              emissiveIntensity: 0,
            })
          : surfaceMaterial('ivory', r, {
              clearcoat: 0.04,
              clearcoatRoughness: 0.7,
              emissive: 0x8b3512,
              emissiveIntensity: 0,
            }),
      );
    }
    let mesh: THREE.Mesh;
    if (index === 0) {
      mesh = new THREE.Mesh(
        new RoundedBoxGeometry(0.52 * s, 0.52 * s, 0.52 * s, 3, 0.05 * s),
        surfaceMaterial('hewn', 0.26 * s, {
          clearcoat: 0.12,
          clearcoatRoughness: 0.35,
          emissive: 0x8b3512,
          emissiveIntensity: 0,
        }),
      );
      mesh.add(edges(new THREE.BoxGeometry(0.505 * s, 0.505 * s, 0.505 * s), 0.22));
    } else {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.37 * s, 0),
        surfaceMaterial('crystal', 0.37 * s, {
          flatShading: true,
          clearcoat: 0.55,
          clearcoatRoughness: 0.12,
          emissive: 0x8b3512,
          emissiveIntensity: 0,
        }),
      );
      mesh.add(edges(new THREE.OctahedronGeometry(0.373 * s, 0), 0.26));
    }
    mesh.userData.edgeLit = 0.62;
    return mesh;
  }
  function body(index: number, scale = 1) {
    let mesh: THREE.Mesh;
    const s = MOON_SCALE;
    const styled = styledBody(index, s);
    if (styled) mesh = styled;
    else if (index === 0) {
      mesh = new THREE.Mesh(
        new RoundedBoxGeometry(0.52 * s, 0.52 * s, 0.52 * s, 3, 0.05 * s),
        new THREE.MeshPhysicalMaterial({
          // Warm graphite: under the warm key the lit face reads bronze-grey,
          // not the silver slab a neutral grey gave.
          color: 0x4e4843,
          metalness: 0.78,
          roughness: 0.52,
          roughnessMap: brushed,
          anisotropy: 0.75,
          clearcoat: 0.15,
          clearcoatRoughness: 0.3,
          emissive: 0x8b3512,
          emissiveIntensity: 0,
        }),
      );
      mesh.add(edges(new THREE.BoxGeometry(0.505 * s, 0.505 * s, 0.505 * s), 0.55));
    } else if (index === 1) mesh = rustMoon(s);
    else {
      const geometry = new THREE.OctahedronGeometry(0.37 * s, 0);
      mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshPhysicalMaterial({
          color: 0x3a3e3b,
          metalness: 0.78,
          roughness: 0.3,
          flatShading: true,
          emissive: 0x8b3512,
          emissiveIntensity: 0,
        }),
      );
      mesh.add(edges(new THREE.OctahedronGeometry(0.373 * s, 0), 0.7));
    }
    mesh.scale.setScalar(scale);
    // Flat metal faces read graphite, not mirror; the key and rim shape them.
    const envBase = styled
      ? moonStyle === 'spheres'
        ? index === 0
          ? 0.55
          : 0.45
        : index === 0
          ? 0.45
          : 0.8
      : index === 0
        ? 0.4
        : index === 2
          ? 0.7
          : 1;
    (mesh.material as THREE.MeshPhysicalMaterial).envMapIntensity = envBase;
    mesh.userData.envBase = envBase;
    mesh.rotation.set(0.3, 0.5, 0.15);
    const edge = mesh.children[0] as THREE.LineSegments | undefined;
    mesh.userData.edge = edge?.material;
    mesh.userData.edgeBase = (edge?.material as THREE.LineBasicMaterial | undefined)?.opacity;
    return mesh;
  }
  /** A closed unit-radius tube along the exact Kepler ellipse (see traceMaterial). */
  function trace(o: Orbit, opacity: number) {
    const pts = Array.from(
      { length: 240 },
      (_, j) =>
        new THREE.Vector3(...orbitPosition({ ...o, phase: 0 }, (j / 240) * o.period)),
    );
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 480, 1, 6, true),
      traceMaterial(opacity),
    );
    // Draw after the opaque bodies so the depth test hides the far side.
    mesh.renderOrder = 2;
    return mesh;
  }
  const traceOpacity = [0.42, 0.38, 0.36];
  const rings = ORBITS.map((o, i) => {
    const r = trace(o, traceOpacity[i]);
    scene.add(r);
    return r;
  });
  const moons = CATEGORIES.map((c, i) => {
    const b = body(i);
    b.userData.category = c.id;
    drawOverTraces(b);
    scene.add(b);
    return b;
  });

  // A faint dust wake behind each moon, along its own orbit only.
  let seed = 8127;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const WAKE_POINTS = 120,
    WAKE_SPAN = 0.12;
  const dust = new THREE.Group();
  scene.add(dust);
  const wakes = ORBITS.map(() => {
    const geometry = new THREE.BufferGeometry();
    const age = new Float32Array(WAKE_POINTS),
      glint = new Float32Array(WAKE_POINTS),
      offset = new Float32Array(WAKE_POINTS * 3);
    for (let k = 0; k < WAKE_POINTS; k++) {
      age[k] = Math.pow(k / (WAKE_POINTS - 1), 0.85);
      glint[k] = random();
      // Scatter widens with age, like dust settling out of the body's path.
      const spread = 0.01 + 0.075 * Math.pow(age[k], 1.3);
      offset[k * 3] = (random() - 0.5) * 2 * spread;
      offset[k * 3 + 1] = (random() - 0.5) * 1.2 * spread;
      offset[k * 3 + 2] = (random() - 0.5) * 2 * spread;
    }
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(WAKE_POINTS * 3), 3),
    );
    geometry.setAttribute('age', new THREE.Float32BufferAttribute(age, 1));
    geometry.setAttribute('glint', new THREE.Float32BufferAttribute(glint, 1));
    const points = new THREE.Points(geometry, wakeMaterial());
    points.frustumCulled = false;
    points.renderOrder = 3;
    dust.add(points);
    return { points, age, offset };
  });
  function updateWake(i: number, t: number, alpha: number) {
    const { points, age, offset } = wakes[i];
    const o = ORBITS[i];
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < WAKE_POINTS; k++) {
      const p = orbitPosition(o, t - age[k] * WAKE_SPAN * o.period);
      pos.setXYZ(k, p[0] + offset[k * 3], p[1] + offset[k * 3 + 1], p[2] + offset[k * 3 + 2]);
    }
    pos.needsUpdate = true;
    const u = (points.material as THREE.ShaderMaterial).uniforms;
    u.uAlpha.value = alpha;
    u.uSize.value = 2.1 * renderer.getPixelRatio();
  }

  const childGroup = new THREE.Group();
  childGroup.visible = false;
  scene.add(childGroup);
  const childRings = CHILD_ORBITS.map((o) => {
    const r = trace(o, 0.3);
    childGroup.add(r);
    return r;
  });
  const children = [0, 1, 2].map((i) => {
    const b = body(i, CHILD_SCALE);
    drawOverTraces(b);
    childGroup.add(b);
    return b;
  });

  const pathGeometry = new THREE.BufferGeometry();
  const PATH_STEPS = 64;
  pathGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array((PATH_STEPS + 1) * 3), 3),
  );
  pathGeometry.setAttribute(
    't',
    new THREE.Float32BufferAttribute(
      Float32Array.from({ length: PATH_STEPS + 1 }, (_, i) => i / PATH_STEPS),
      1,
    ),
  );
  const path = new THREE.Line(pathGeometry, pathMaterial());
  path.visible = false;
  scene.add(path);

  // ---- Labels: chips with a short leader line, offset away from the centre.
  const labelLayer = document.createElement('div');
  labelLayer.className = 'scene-labels';
  host.appendChild(labelLayer);
  const svgNS = 'http://www.w3.org/2000/svg';
  const leaderLayer = document.createElementNS(svgNS, 'svg');
  leaderLayer.setAttribute('class', 'label-leaders');
  labelLayer.appendChild(leaderLayer);
  type Label = {
    el: HTMLButtonElement;
    leader: SVGLineElement;
    index: number;
    full: { w: number; h: number };
    compact: { w: number; h: number };
  };
  const labelButtons: Label[] = [];

  let category: CategoryId | null = null,
    transition: { from: number; to: number; started: number; duration: number } | null =
      null,
    transitionToken = 0,
    childrenShown = false;
  let blend = 0,
    simT = 0,
    childT = 0,
    last = performance.now(),
    paused = false,
    held = false,
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
    visible = true,
    offscreen = false,
    fallback = false,
    pending = false,
    empty = false,
    disposed = false,
    frame = 0;
  let selectedIndex = 0;
  const snapshotPositions = moons.map(() => new THREE.Vector3());
  let fatal = false,
    meshHeld = false;
  /** Envelope supplied by the host; the renderer adds only procedural texture. */
  let envelopeIn = 0,
    speechT = 0,
    speechEnvelope = 0;
  let emphasized: CategoryId | null = null;
  let lastLabelUpdate = 0;

  for (let i = 0; i < 3; i++) {
    const el = document.createElement('button');
    el.className = 'moon-label';
    el.tabIndex = -1;
    el.type = 'button';
    el.addEventListener('pointerenter', () => {
      held = true;
      wake();
    });
    el.addEventListener('pointerleave', () => {
      held = false;
      meshHeld = false;
      wake();
    });
    el.addEventListener('click', () => {
      if (transition) return;
      if (category) {
        if (!empty) hooks.onItem(CATEGORIES[selectedIndex].items[i]);
      } else hooks.onCategoryRequest(CATEGORIES[i].id);
    });
    labelLayer.appendChild(el);
    const leader = document.createElementNS(svgNS, 'line');
    leaderLayer.appendChild(leader);
    labelButtons.push({ el, leader, index: i, full: { w: 0, h: 0 }, compact: { w: 0, h: 0 } });
  }
  function measureLabels() {
    labelButtons.forEach((l) => {
      l.el.classList.remove('is-compact');
      l.full = { w: l.el.offsetWidth, h: l.el.offsetHeight };
      l.el.classList.add('is-compact');
      l.compact = { w: l.el.offsetWidth, h: l.el.offsetHeight };
      l.el.classList.remove('is-compact');
    });
  }
  function updateLabelsText() {
    labelButtons.forEach(({ el, index }) => {
      const c = CATEGORIES[selectedIndex];
      const [title, meta] = category
        ? [
            c.items[index].title,
            c.items[index].locked
              ? 'Additional access'
              : c.items[index].placeholder
                ? 'Placeholder'
                : (c.items[index].cta ?? `Explore ${c.singular}`),
          ]
        : [
            CATEGORIES[index].name,
            `${CATEGORIES[index].items.length} ${CATEGORIES[index].noun}`,
          ];
      const strong = document.createElement('strong');
      strong.textContent = title;
      const small = document.createElement('span');
      small.textContent = meta;
      el.replaceChildren(strong, small);
      el.title = title;
    });
    measureLabels();
  }
  updateLabelsText();

  // Navigation guards live in lib/map-state; these only execute commands.
  function startTransition(to: number, o: TransitionOptions) {
    held = false;
    meshHeld = false;
    transitionToken = o.token;
    transition = {
      from: blend,
      to,
      started: performance.now(),
      duration: o.instant || fallback ? 0 : 850,
    };
    // An instant transition settles now: a hidden tab runs no frames.
    if (transition.duration === 0) completeTransition();
    else wake();
  }
  function enter(id: CategoryId, o: TransitionOptions & { phase: number }) {
    selectedIndex = CATEGORIES.findIndex((c) => c.id === id);
    category = id;
    // Overview positions are a pure function of the phase the host captured.
    moons.forEach((_, i) => snapshotPositions[i].set(...orbitPosition(ORBITS[i], o.phase)));
    startTransition(1, o);
  }
  function leave(o: TransitionOptions) {
    category = null;
    startTransition(0, o);
  }
  function settle() {
    updateLabelsText();
    hooks.onSettled(transitionToken);
  }
  function completeTransition() {
    if (!transition) return;
    blend = transition.to;
    transition = null;
    settle();
    wake();
  }

  // ---- Camera: fitted per level to the real stage, blended with the transition.
  const dims = { width: 800, height: 570 };
  let poses: { overview: Pose; collection: Pose } = {
    overview: overviewPose(800, 570, layout),
    collection: collectionPose(800, 570),
  };
  /** Where the former centre rests while a collection is open (top-left, behind). */
  const formerCenter = new THREE.Vector3(-2.8, 1.1, -2);
  const pose: Pose = { ...poses.overview };
  const up = new THREE.Vector3(0, 1, 0);
  function applyPose(p: Pose) {
    camera.position.set(...cameraPosition(p));
    camera.up.copy(up);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // Vertical bias: offset NDC y without moving the camera.
    camera.projectionMatrix.elements[9] = -p.shift;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
  }
  function placeFormerCenter() {
    const p = poses.collection;
    applyPose(p);
    const compact = dims.width < 600;
    const ndc = new THREE.Vector3(compact ? -0.66 : -0.76, compact ? 0.5 : 0.52, 0.5);
    const reserve = stageReserve(dims.width);
    ndc.y = Math.min(ndc.y, 1 - (2 * (reserve.top + 34)) / dims.height);
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const depth = p.distance + 2.5;
    formerCenter.copy(camera.position).addScaledVector(dir, depth / dir.dot(forward));
  }
  function resize() {
    const r = host.getBoundingClientRect();
    dims.width = r.width;
    dims.height = r.height;
    if (!r.width || !r.height) return;
    camera.aspect = r.width / r.height;
    poses = {
      overview: overviewPose(r.width, r.height, layout),
      collection: collectionPose(r.width, r.height),
    };
    placeFormerCenter();
    renderer.setSize(r.width, r.height, false);
    composer.setSize(r.width, r.height);
    leaderLayer.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    measureLabels();
    wake();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const point = new THREE.Vector3(),
    tmp = new THREE.Vector3(),
    ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const labelRay = new THREE.Raycaster();
  const camUp = new THREE.Vector3();
  function toScreen(v: THREE.Vector3) {
    tmp.copy(v).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * dims.width, y: (-tmp.y * 0.5 + 0.5) * dims.height, ndc: tmp.clone() };
  }
  /**
   * The centre overlay (eyebrow, title, subtitle) is a sibling of the canvas;
   * publish the centred world's projected position and radius as CSS custom
   * properties on the stage so the overlay sits on the body, not on the
   * stage's geometric centre (the fitted camera shift moves the body).
   */
  const stageEl = host.parentElement;
  let publishedCenter = '';
  // Toolbar height changes with its content (breadcrumb wrap); cache it from
  // a ResizeObserver instead of forcing layout on every label pass.
  const toolbarEl = stageEl?.querySelector<HTMLElement>('.stage-toolbar') ?? null;
  let toolbarBottom: number | undefined;
  const toolbarObserver = new ResizeObserver(() => {
    if (!toolbarEl) return;
    toolbarBottom = toolbarEl.offsetTop + toolbarEl.offsetHeight;
    wake();
  });
  if (toolbarEl) toolbarObserver.observe(toolbarEl);
  function publishCenter() {
    const centred = blend >= 0.5 && category !== null ? moons[selectedIndex] : planet;
    centred.getWorldPosition(point);
    const c = toScreen(point);
    const radius = category
      ? CENTER[selectedIndex] * RADII[selectedIndex]
      : PLANET_RADIUS;
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const e = toScreen(tmp.copy(point).addScaledVector(camUp, radius));
    const r = Math.hypot(e.x - c.x, e.y - c.y);
    const key = `${c.x.toFixed(0)},${c.y.toFixed(0)},${r.toFixed(0)}`;
    if (key === publishedCenter || !stageEl) return;
    publishedCenter = key;
    if (!category) measureTextZone(r);
    stageEl.style.setProperty('--center-x', `${c.x.toFixed(1)}px`);
    stageEl.style.setProperty('--center-y', `${c.y.toFixed(1)}px`);
    stageEl.style.setProperty('--center-r', `${r.toFixed(1)}px`);
    host.dataset.centerX = c.x.toFixed(0);
    host.dataset.centerY = c.y.toFixed(0);
    host.dataset.centerR = r.toFixed(0);
  }
  /**
   * Tell the planet where the overlay title sits over its disc (in planet
   * radii) so the speaking response stays calm behind the text. Measured from
   * the title's text box, not its block box.
   */
  const titleEl = stageEl?.querySelector<HTMLElement>('#map-current-title') ?? null;
  const titleRange = document.createRange();
  function measureTextZone(radiusPx: number) {
    if (!titleEl || radiusPx < 1) return;
    titleRange.selectNodeContents(titleEl);
    const box = titleRange.getBoundingClientRect();
    if (!box.width) return;
    planetBody.setTextZone(box.width / 2 / radiusPx, box.height / 2 / radiusPx);
  }
  void document.fonts?.ready.then(() => {
    publishedCenter = '';
    wake();
  });
  function hideLabel(l: Label) {
    l.el.style.opacity = '0';
    l.el.style.pointerEvents = 'none';
    l.leader.style.opacity = '0';
  }
  function labels() {
    const placed: Rect[] = [];
    const center = toScreen(point.set(0, 0, 0));
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    // Labels stay below the toolbar (breadcrumb + instruction or suggestion),
    // which can wrap on phones: measure it rather than assume one height.
    const bounds = labelBounds({
      width: dims.width,
      height: dims.height,
      bottomReserve: stageReserve(dims.width).bottom,
      toolbarBottom,
      breadcrumb: category !== null,
    });
    const centerRadius = category
      ? CENTER[selectedIndex] * RADII[selectedIndex]
      : PLANET_RADIUS;
    const centerEdge = toScreen(tmp.set(0, 0, 0).addScaledVector(camUp, centerRadius));
    // In the overview the obstacle includes the planet's bright limb halo, so
    // chips never sit on the hottest part of the corona.
    const obstacle = {
      x: center.x,
      y: center.y,
      r: Math.hypot(centerEdge.x - center.x, centerEdge.y - center.y) * (category ? 0.92 : 1.08),
    };
    const obstacles = [obstacle];
    // Inside a collection the shrunken overview (planet and its tilted rings)
    // rests top-left; keep child labels off it.
    if (category && blend === 1) {
      const former = toScreen(planet.position);
      const ring = toScreen(
        tmp.copy(planet.position).addScaledVector(camUp, ORBITS[1].a * planet.scale.x),
      );
      obstacles.push({
        x: former.x,
        y: former.y,
        r: Math.hypot(ring.x - former.x, ring.y - former.y),
      });
    }
    // Project every labelled body first so a chip can also keep off the
    // other bodies (on phones the three children crowd one small stage).
    const bodies = labelButtons.map(({ index }) => {
      const mesh = category ? children[index] : moons[index];
      mesh.getWorldPosition(point);
      const world = point.clone();
      const s = toScreen(point);
      const edge = toScreen(tmp.copy(world).addScaledVector(camUp, RADII[index] * mesh.scale.x));
      return { mesh, world, s, radiusPx: Math.hypot(edge.x - s.x, edge.y - s.y) };
    });
    labelButtons.forEach((l) => {
      const { el, index } = l;
      if (transition || fallback || (category && empty)) return hideLabel(l);
      const { mesh, world, s, radiusPx } = bodies[index];
      if (!l.full.w) measureLabels();
      const result = placeLabel({
        anchor: { x: s.x, y: s.y },
        center: { x: center.x, y: center.y },
        radius: radiusPx,
        full: l.full,
        compact: l.compact,
        bounds,
        placed,
        obstacles: [
          ...obstacles,
          ...bodies
            .filter((_, j) => j !== index)
            .map((o) => ({ x: o.s.x, y: o.s.y, r: o.radiusPx + 3 })),
        ],
      });
      placed.push(result.rect);
      el.classList.toggle('is-compact', result.compact);
      labelRay.setFromCamera(new THREE.Vector2(s.ndc.x, s.ndc.y), camera);
      const blocker = category ? moons[selectedIndex] : planet;
      const occluded =
        labelRay.intersectObjects([blocker, mesh], false)[0]?.object !== mesh;
      const r = result.rect;
      el.style.transform = `translate(${r.x}px,${r.y}px)`;
      // Labels of bodies on the far half of their orbit sit back slightly.
      const far = world.distanceTo(camera.position) > camera.position.length() + 0.7;
      const opacity = occluded ? '0' : far ? '.82' : '1';
      el.style.opacity = opacity;
      el.style.pointerEvents = occluded ? 'none' : 'auto';
      l.leader.setAttribute('x1', result.leader.x1.toFixed(1));
      l.leader.setAttribute('y1', result.leader.y1.toFixed(1));
      l.leader.setAttribute('x2', result.leader.x2.toFixed(1));
      l.leader.setAttribute('y2', result.leader.y2.toFixed(1));
      l.leader.style.opacity = occluded || !result.leader.visible ? '0' : opacity;
    });
  }
  function pointerHit(e: MouseEvent) {
    if (category && empty) return -1;
    const rect = host.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const targets = category ? children : moons;
    const center = category ? moons[selectedIndex] : planet;
    return targets.indexOf(
      ray.intersectObjects([...targets, center], false)[0]?.object as THREE.Mesh,
    );
  }
  function pointerMove(e: PointerEvent) {
    const hovered = pointerHit(e) >= 0 && e.pointerType !== 'touch';
    host.style.cursor = hovered ? 'pointer' : 'default';
    if (meshHeld !== hovered) {
      meshHeld = hovered;
      wake();
    }
  }
  function pointerClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.moon-label') || transition || fallback) return;
    const i = pointerHit(e);
    if (i < 0) return;
    if (category) {
      if (!empty) hooks.onItem(CATEGORIES[selectedIndex].items[i]);
    } else {
      hooks.onCategoryRequest(CATEGORIES[i].id);
    }
  }
  function pointerLeave() {
    meshHeld = false;
    wake();
  }
  renderer.domElement.addEventListener('pointerleave', pointerLeave);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('click', pointerClick);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  function contextLost(e: Event) {
    e.preventDefault();
    fallback = true;
    fatal = true;
    completeTransition();
    hooks.onFailure();
    wake();
  }

  function setTrace(
    line: THREE.Mesh,
    bodyPosition: THREE.Vector3,
    a: number,
    opacity: number,
    boost: number,
  ) {
    const u = (line.material as THREE.ShaderMaterial).uniforms;
    const dc = camera.position.distanceTo(line.position);
    const reach = a * 1.05 * line.scale.x;
    u.uNear.value = dc - reach;
    u.uFar.value = dc + reach;
    u.uBody.value.copy(bodyPosition);
    u.uOpacity.value = opacity;
    u.uBoost.value = boost;
    u.uScale.value = line.scale.x;
    // World units per CSS pixel per unit of view depth.
    u.uPx.value = (2 * Math.tan(((FOV_Y / 2) * Math.PI) / 180)) / Math.max(dims.height, 1);
  }
  /**
   * Depth cue for a body at world position p on an orbit of radius `reach`
   * around the view centre: an extra 1.1..0.9 scale from near to far, and a
   * 0..1 haze when it is behind the planet and close to its disc on screen.
   */
  const viewPoint = new THREE.Vector3();
  function depthCue(p: THREE.Vector3, reach: number) {
    viewPoint.copy(p).applyMatrix4(camera.matrixWorldInverse);
    const depth = -viewPoint.z,
      centre = pose.distance;
    const lateral = (Math.hypot(viewPoint.x, viewPoint.y) * centre) / Math.max(depth, 0.1);
    const behind =
      THREE.MathUtils.smoothstep(depth - centre, 0, reach * 0.6) *
      (1 - THREE.MathUtils.smoothstep(lateral, PLANET_RADIUS * 0.9, PLANET_RADIUS * 2));
    return { scale: depthScale(depth, centre, reach), haze: behind };
  }
  function setHaze(m: THREE.Mesh, haze: number) {
    const mat = m.material as THREE.MeshPhysicalMaterial;
    const base = (m.userData.baseColor ??= mat.color.clone()) as THREE.Color;
    mat.color.copy(base).multiplyScalar(1 - 0.4 * haze);
    mat.envMapIntensity = (m.userData.envBase ?? 1) * (1 - 0.5 * haze);
    const edge = m.userData.edge as THREE.LineBasicMaterial | undefined;
    if (edge) edge.opacity *= 1 - 0.55 * haze;
    const surface = mat.userData.surface as SurfaceUniforms | undefined;
    if (surface) surface.uMsVein.value = 1 - 0.6 * haze;
  }
  function setGlow(m: THREE.Mesh, intensity: number, lit = false) {
    const mat = m.material as THREE.MeshPhysicalMaterial;
    mat.emissiveIntensity = intensity;
    const edge = m.userData.edge as THREE.LineBasicMaterial | undefined;
    if (edge) edge.opacity = lit ? (m.userData.edgeLit ?? 1) : m.userData.edgeBase;
  }

  const frameTimes: number[] = [];
  let diagnosticAt = 0,
    totalFrames = 0;
  const origin = new THREE.Vector3();
  const pathStart = new THREE.Vector3(),
    pathEnd = new THREE.Vector3(),
    pathControl = new THREE.Vector3();
  function update(now: number) {
    if (disposed) return;
    frame = 0;
    const elapsed = now - last;
    const dt = Math.min(elapsed / 1000, 0.05);
    if (elapsed > 1 && frameTimes.length < 3600) frameTimes.push(elapsed);
    last = now;
    // Attack/decay come from lib/narration; at envelope 1 this equals the
    // former speaking target exactly.
    const modulating =
      !paused && !reduced && visible && !offscreen && !fallback && envelopeIn > 0.002;
    if (modulating) speechT += dt;
    speechEnvelope =
      reduced || paused
        ? 0
        : envelopeIn *
          (0.35 +
            0.65 * Math.pow(Math.abs(Math.sin(speechT * 7.3) * Math.cos(speechT * 3.1)), 0.6));
    const moving =
      !paused && !reduced && !held && !meshHeld && visible && !offscreen && !fallback;
    if (moving && !transition) {
      if (category) childT += dt;
      else simT += dt;
    }
    if (transition) {
      const t =
        transition.duration === 0
          ? 1
          : Math.min(1, (now - transition.started) / transition.duration);
      blend = THREE.MathUtils.lerp(transition.from, transition.to, ease(t));
      if (t >= 1) {
        transition = null;
        settle();
      }
    }
    // Camera follows the level fit.
    pose.distance = THREE.MathUtils.lerp(poses.overview.distance, poses.collection.distance, blend);
    pose.elevation = THREE.MathUtils.lerp(poses.overview.elevation, poses.collection.elevation, blend);
    pose.shift = THREE.MathUtils.lerp(poses.overview.shift, poses.collection.shift, blend);
    applyPose(pose);

    // The whole overview system shrinks into the former-centre position together.
    const systemScale = 1 - blend * (1 - CORNER);
    planet.position.lerpVectors(origin, formerCenter, blend);
    // The planet swells with speech inside planetBody.update; scale here is layout only.
    planet.scale.setScalar(systemScale);
    atmosphere.scale.copy(planet.scale);
    atmosphere.position.copy(planet.position);
    if (!paused && !reduced) planetT += dt;
    planetBody.update(planetT, speechEnvelope * (1 - blend), 0, 1 - blend * 0.55, 1 - blend);
    dust.visible = blend < 0.99;
    dust.position.copy(planet.position);
    dust.scale.setScalar(systemScale);
    const wakeAlpha = 0.55 * Math.max(0, 1 - blend * 3) * (pending ? 1.5 : 1);
    if (dust.visible) ORBITS.forEach((_, i) => updateWake(i, simT, wakeAlpha));

    moons.forEach((m, i) => {
      const id = CATEGORIES[i].id;
      if (transition || blend > 0) m.position.copy(snapshotPositions[i]);
      else m.position.set(...orbitPosition(ORBITS[i], simT));
      if (blend > 0) {
        if (i === selectedIndex) m.position.lerp(origin, blend);
        else m.position.multiplyScalar(systemScale).add(planet.position);
      }
      m.visible = true;
      const cue = depthCue(m.position, ORBITS[i].a * 1.05);
      const cueScale = THREE.MathUtils.lerp(cue.scale, 1, blend);
      m.scale.setScalar(
        i === selectedIndex ? cueScale + blend * (CENTER[i] - 1) : systemScale * cueScale,
      );
      m.rotation.x = 0.3 + simT * 0.045;
      m.rotation.y = 0.5 + simT * 0.1;
      const lit = emphasized === id;
      setGlow(
        m,
        i === selectedIndex && blend > 0
          ? (lit ? 0.12 : 0) + (blend === 1 ? speechEnvelope * 0.22 : 0)
          : lit
            ? 0.16 + blend * 1.1
            : 0,
        lit,
      );
      setHaze(m, cue.haze * (1 - blend));
      const ring = rings[i];
      ring.position.copy(planet.position);
      ring.scale.setScalar(systemScale);
      const ringOpacity =
        traceOpacity[i] * (i === selectedIndex ? 1 - blend : 1 - blend * 0.55);
      ring.visible = ringOpacity > 0.01;
      setTrace(ring, m.position, ORBITS[i].a, ringOpacity, lit ? 1.1 : 0);
    });

    childGroup.visible = childrenShown && !empty;
    host.dataset.childrenVisible = String(childGroup.visible);
    host.dataset.speaking = String(envelopeIn > 0.002);
    host.dataset.speechEnvelope = String(speechEnvelope);
    children.forEach((m, i) => {
      m.position.set(...orbitPosition(CHILD_ORBITS[i], childT));
      m.scale.setScalar(CHILD_SCALE * depthCue(m.position, CHILD_ORBITS[i].a * 1.05).scale);
      m.rotation.y = childT * 0.1 + i;
      setTrace(childRings[i], m.position, CHILD_ORBITS[i].a, 0.3, 0);
    });

    // Path toward the world an answer points to, when that is not the centre.
    const target =
      blend === 1 && emphasized && CATEGORIES[selectedIndex].id !== emphasized
        ? moons[CATEGORIES.findIndex((c) => c.id === emphasized)]
        : null;
    path.visible = !!target && !fallback;
    if (target) {
      pathEnd.copy(target.position);
      const dir = tmp.copy(pathEnd).normalize();
      pathStart.copy(dir).multiplyScalar(
        CENTER[selectedIndex] * RADII[selectedIndex] * 1.12,
      );
      pathControl
        .copy(pathStart)
        .lerp(pathEnd, 0.5)
        .add(new THREE.Vector3(0, 0.9, 1.2));
      const pos = pathGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i <= PATH_STEPS; i++) {
        const t = i / PATH_STEPS,
          a = (1 - t) * (1 - t),
          b = 2 * (1 - t) * t,
          c = t * t;
        pos.setXYZ(
          i,
          a * pathStart.x + b * pathControl.x + c * pathEnd.x,
          a * pathStart.y + b * pathControl.y + c * pathEnd.y,
          a * pathStart.z + b * pathControl.z + c * pathEnd.z,
        );
      }
      pos.needsUpdate = true;
      const pm = (path.material as THREE.ShaderMaterial).uniforms;
      pm.uFlow.value = childT * 0.6;
      pm.uAlpha.value = 0.55;
    }

    if (!fallback && visible && !offscreen) {
      composer.render();
      totalFrames++;
      if (now - diagnosticAt > 1000 || paused || reduced) {
        const times = [...frameTimes].sort((a, b) => a - b);
        const count = times.length;
        host.dataset.frameCount = String(totalFrames);
        host.dataset.frameP50 = String(times[Math.floor(count * 0.5)] || 0);
        host.dataset.frameP95 = String(times[Math.floor(count * 0.95)] || 0);
        host.dataset.frameSamples = String(count);
        host.dataset.simTime = String(simT);
        host.dataset.childTime = String(childT);
        host.dataset.cameraDistance = pose.distance.toFixed(2);
        host.dataset.path = String(path.visible);
        diagnosticAt = now;
      }
      publishCenter();
      if (now - lastLabelUpdate > 25 || !moving) {
        labels();
        lastLabelUpdate = now;
      }
    }
    // The planet keeps its own motion while a moon is hovered or held, so the
    // loop runs whenever motion is allowed, not only while the orbits advance.
    const alive = !paused && !reduced;
    if ((alive || moving || modulating || transition) && !fallback && visible && !offscreen)
      frame = requestAnimationFrame(update);
    else if (transition && visible) frame = requestAnimationFrame(update);
  }
  function wake() {
    if (disposed) return;
    last = performance.now();
    if (!frame) frame = requestAnimationFrame(update);
  }
  // Visibility is reported to the host; its state machine answers with
  // `completeTransition` when a flight is running, so navigation never waits
  // on an unseen animation.
  let reportedVisible = true;
  function visibilityChanged() {
    const now = visible && !offscreen;
    if (!now && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else wake();
    if (now !== reportedVisible) {
      reportedVisible = now;
      hooks.onVisibility(now);
    }
  }
  function visibility() {
    visible = !document.hidden;
    visibilityChanged();
  }
  document.addEventListener('visibilitychange', visibility);
  const intersection = new IntersectionObserver(
    (entries) => {
      offscreen = !entries[0].isIntersecting;
      visibilityChanged();
    },
    { threshold: 0.01 },
  );
  intersection.observe(host);
  resize();
  wake();
  hooks.onReady();
  return {
    enter,
    leave,
    showChildren() {
      childrenShown = true;
      wake();
    },
    hideChildren() {
      childrenShown = false;
      childGroup.visible = false;
      host.dataset.childrenVisible = 'false';
      wake();
    },
    restorePhase(phase) {
      simT = phase;
      wake();
    },
    completeTransition,
    getPhase: () => simT,
    setEnvelope(value) {
      envelopeIn = Math.max(0, Math.min(1, value));
      wake();
    },
    pause(value) {
      paused = value;
      wake();
    },
    hold(value) {
      held = value;
      wake();
    },
    reduceMotion(value) {
      reduced = value;
      wake();
    },
    setFallback(value) {
      fallback = value || fatal;
      // The static view has no flight to show: finish any running one.
      if (fallback) completeTransition();
      if (value) labelButtons.forEach(hideLabel);
      wake();
    },
    setPending(value) {
      pending = value;
      wake();
    },
    setEmpty(value) {
      empty = value;
      wake();
    },
    emphasize(id) {
      emphasized = id;
      wake();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      toolbarObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('pointerleave', pointerLeave);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('click', pointerClick);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat?.dispose());
      });
      brushed.dispose();
      rust.dispose();
      environment.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      host.replaceChildren();
    },
  };
}
