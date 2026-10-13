import * as THREE from 'three';
import { surfaceMaterial } from './moon-surfaces';

/**
 * The built-world kit (ticket #16): the structures the Portfolio and Playbooks heroes put on the
 * planet. Ported from the built-world lab (Brandon OS `analysis/2026-10-13-portfolio-built-world/
 * lab/src/world.ts`, Brandon's picks of October 13: K2 Three approaches, F3 Limb and lights).
 *
 * - An instanced structure kit (slab, setback, drum, twist, needle, faceted dome, span, arch) on a
 *   patched MeshPhysicalMaterial: graphite panels, glass floor/column window grids that fade to a
 *   flat tone when they get too small to resolve (no shimmer), a few lit windows and copper crowns.
 *   Being physical, the structures keep the stage's lights, environment, fog, bloom and tone map.
 * - Surface coordinates on a sphere (x right, s forward, a altitude), skyline clusters, a district
 *   grid, a rising structure (`riser`, one element per arrival) with a fade, the basalt ground, the
 *   atmosphere shell, and night-side city lights clustered into lit blocks.
 *
 * Nothing here is relational: the structures are a built world, not a map of the stories or the
 * methods. AI-made choices, reversible.
 */

const TAU = Math.PI * 2;
const ADD = THREE.AdditiveBlending;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const WARM = new THREE.Color(0xffc27a);
export const COPPER = new THREE.Color(0xf0a468);

/** A seeded generator (Park–Miller), so posters are repeatable. */
export function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export type BType = 'slab' | 'setback' | 'drum' | 'dome' | 'twist' | 'needle' | 'span' | 'arch';

/** A structure: type, surface position (x, s), footprint (w, d), height, yaw, a window seed
 *  (negative = no windows) and a base altitude (spans). */
export interface Bld {
  type: BType;
  x: number;
  s: number;
  w: number;
  d: number;
  h: number;
  yaw?: number;
  seed?: number;
  a?: number;
}

/** A patch of a sphere: centre, radius, the patch's normal and two tangents. */
export interface Surface {
  C: THREE.Vector3;
  R: number;
  n0: THREE.Vector3;
  e1: THREE.Vector3;
  e2: THREE.Vector3;
}

/** Local surface coordinates (x right, s forward, a altitude) → world. */
export function S(sf: Surface, x: number, s: number, a = 0, out = V()) {
  out.copy(sf.n0).multiplyScalar(sf.R).addScaledVector(sf.e1, x).addScaledVector(sf.e2, s).normalize();
  return out.multiplyScalar(sf.R + a).add(sf.C);
}
export function upAt(sf: Surface, x: number, s: number) {
  return S(sf, x, s, 0).sub(sf.C).normalize();
}

/* ---- unit geometries (base at y = 0, unit footprint and height) ---- */
function mergeFlat(gs: THREE.BufferGeometry[]) {
  const parts = gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  const total = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const sz = parts[0].attributes[k].itemSize;
    const arr = new Float32Array(total * sz);
    let o = 0;
    for (const g of parts) {
      arr.set(g.attributes[k].array as Float32Array, o);
      o += g.attributes[k].count * sz;
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, sz));
  }
  out.computeVertexNormals(); // non-indexed: flat facets that catch the light
  gs.forEach((g) => g.dispose());
  parts.forEach((g) => g.dispose());
  return out;
}

function unitGeoms(): Record<BType, THREE.BufferGeometry> {
  const box = (w: number, h: number, d: number, y: number) => new THREE.BoxGeometry(w, h, d).translate(0, y + h / 2, 0);
  const twist = (() => {
    const g = new THREE.CylinderGeometry(0.34, 0.5, 1, 6, 18).translate(0, 0.5, 0).toNonIndexed();
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i),
        a = y * 1.2,
        x = p.getX(i),
        z = p.getZ(i);
      p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
    }
    g.computeVertexNormals();
    return g;
  })();
  return {
    slab: box(1, 1, 1, 0),
    setback: mergeFlat([box(1, 0.56, 1, 0), box(0.74, 0.28, 0.74, 0.56), box(0.46, 0.16, 0.46, 0.84)]),
    drum: mergeFlat([
      new THREE.CylinderGeometry(0.5, 0.5, 0.86, 24, 1).translate(0, 0.43, 0),
      new THREE.CylinderGeometry(0.1, 0.5, 0.14, 24, 1).translate(0, 0.93, 0),
    ]),
    dome: mergeFlat([
      new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14, 1).translate(0, 0.15, 0),
      new THREE.SphereGeometry(0.5, 14, 5, 0, TAU, 0, Math.PI / 2).scale(1, 1.4, 1).translate(0, 0.3, 0),
    ]),
    twist,
    needle: new THREE.CylinderGeometry(0.05, 0.5, 1, 8, 1).translate(0, 0.5, 0),
    span: new THREE.BoxGeometry(1, 1, 1),
    arch: new THREE.TorusGeometry(0.5, 0.07, 8, 40, Math.PI),
  };
}

/** Graphite towers with glass bands and a few lit windows. `lit`: share of windows on; `fh`:
 *  floor height in world units (the column width is 1.25 floors). */
export function buildingMaterial(lit: number, fh: number) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.45,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    emissive: 0x000000,
  });
  const u = {
    uLit: { value: lit },
    uFH: { value: fh },
    uCW: { value: fh * 1.25 },
    uWin: { value: WARM.clone().multiplyScalar(1.35) },
    uEdge: { value: COPPER.clone().multiplyScalar(0.9) },
  };
  m.userData.u = u;
  m.customProgramCacheKey = () => 'bw-building';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aBox;attribute float aSeed;varying vec3 vL;varying float vSeed;varying float vNy;varying float vTop;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvL=position*aBox;vSeed=aSeed;vNy=normal.y;vTop=aBox.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uLit;uniform float uFH;uniform float uCW;uniform vec3 uWin;uniform vec3 uEdge;
varying vec3 vL;varying float vSeed;varying float vNy;varying float vTop;
float bh(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float bVert=1.-smoothstep(.3,.6,abs(vNy));
vec2 bg=vec2((vL.x+vL.z)/uCW,vL.y/uFH);
vec2 bc=floor(bg),bf=fract(bg);
vec2 bw=fwidth(bg);
float bLod=1.-smoothstep(.22,.55,max(bw.x,bw.y));
float bWin=smoothstep(.14,.14+bw.x,bf.x)*smoothstep(.86,.86-bw.x,bf.x)*smoothstep(.24,.24+bw.y,bf.y)*smoothstep(.8,.8-bw.y,bf.y);
float bOk=step(0.,vSeed)*step(1.,bc.y)*step(vL.y,vTop-uFH*.6);
bWin=mix(.42,bWin,bLod)*bVert*bOk;
float bH=bh(vec3(bc,vSeed*7.31+.5));
float bOn=step(bH,uLit*(.5+fract(vSeed*3.17)))*smoothstep(.2,.35,bWin);
float bPanel=bh(vec3(floor((vL.x+vL.z)*14.),floor(vL.y*5.),vSeed));
vec3 bAlb=mix(vec3(.17,.175,.18),vec3(.33,.33,.335),fract(abs(vSeed)*5.71)*.55+bPanel*.18);
diffuseColor.rgb*=pow(mix(bAlb,vec3(.04,.045,.05),bWin*.8),vec3(2.2));`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.62,.16,bWin);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=mix(.42,.85,bWin);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float bCrown=smoothstep(vTop-uFH*.55,vTop-uFH*.3,vL.y)*bVert*step(.62,fract(abs(vSeed)*9.13))*step(0.,vSeed);
totalEmissiveRadiance+=uWin*bOn*(.45+.9*fract(bH*13.7))*mix(.22,1.,bLod)+uEdge*bCrown*.7;`,
      );
  };
  return m;
}

/** Instanced structures, one InstancedMesh per type and call. */
export class Structures {
  private geoms = unitGeoms();
  private owned: THREE.BufferGeometry[] = [];
  meshes: THREE.InstancedMesh[] = [];
  constructor(
    private parent: THREE.Object3D,
    public mat: THREE.MeshPhysicalMaterial,
  ) {}
  add(sf: Surface, list: Bld[]) {
    const by = new Map<BType, Bld[]>();
    for (const b of list) by.set(b.type, [...(by.get(b.type) ?? []), b]);
    const out: THREE.InstancedMesh[] = [];
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      qy = new THREE.Quaternion(),
      Y = V(0, 1, 0);
    for (const [type, bs] of by) {
      const g = this.geoms[type].clone();
      this.owned.push(g);
      const box = new Float32Array(bs.length * 3),
        seed = new Float32Array(bs.length);
      const im = new THREE.InstancedMesh(g, this.mat, bs.length);
      bs.forEach((b, i) => {
        q.setFromUnitVectors(Y, upAt(sf, b.x, b.s));
        qy.setFromAxisAngle(Y, b.yaw ?? 0);
        q.multiply(qy);
        // Sink the base a little so it meets the curved ground without a gap.
        m.compose(S(sf, b.x, b.s, (b.a ?? 0) - 0.004 * b.h), q, V(b.w, b.h * 1.004, b.d));
        im.setMatrixAt(i, m);
        box.set([b.w, b.h, b.d], i * 3);
        seed[i] = b.seed ?? (i * 0.6180339 + type.length * 0.137) % 1;
      });
      g.setAttribute('aBox', new THREE.InstancedBufferAttribute(box, 3));
      g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      this.parent.add(im);
      this.meshes.push(im);
      out.push(im);
    }
    return out;
  }
  dispose() {
    this.meshes.forEach((m) => m.dispose());
    this.owned.forEach((g) => g.dispose());
    Object.values(this.geoms).forEach((g) => g.dispose());
    this.mat.dispose();
  }
}

/** A skyline cluster: a tall core falling off to the edges, a mix of silhouettes. */
export function cityCluster(rnd: () => number, cx: number, cs: number, rx: number, rs: number, hMax: number, n: number, foot: number): Bld[] {
  const out: Bld[] = [];
  const types: BType[] = ['slab', 'slab', 'setback', 'setback', 'drum', 'twist', 'slab', 'dome'];
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU,
      r = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * r * rx,
      s = cs + Math.sin(a) * r * rs;
    const fall = Math.exp(-((r / 0.62) ** 2));
    const type = types[Math.floor(rnd() * types.length)];
    let h = hMax * (0.18 + 0.82 * fall) * (0.45 + 0.55 * rnd());
    let w = foot * (0.7 + 0.6 * rnd());
    if (type === 'dome') {
      h = Math.min(h, foot * 1.1);
      w = foot * (1.4 + rnd());
    }
    if (type === 'twist' || type === 'drum') w *= 0.85;
    out.push({ type, x, s, w, d: type === 'slab' ? w * (0.55 + 0.6 * rnd()) : w, h, yaw: (rnd() - 0.5) * 0.5, seed: type === 'dome' ? -1 : undefined });
  }
  return out;
}

/** A structure built step by step: one element per arrival, each with its own material so it can
 *  glow as it lands and fade (not shrink) when the loop resets. */
export function riser(parent: THREE.Object3D, sf: Surface, steps: Bld[], fh = 0.014) {
  const parts = steps.map((b) => {
    const mat = buildingMaterial(0.5, fh);
    mat.transparent = true; // the reset fades the finished site out
    const st = new Structures(parent, mat);
    const [im] = st.add(sf, [b]);
    const m0 = new THREE.Matrix4();
    im.getMatrixAt(0, m0);
    const pos = V(),
      q = new THREE.Quaternion(),
      sc = V();
    m0.decompose(pos, q, sc);
    return { st, im, mat, pos, q, sc };
  });
  const m = new THREE.Matrix4(),
    k3 = V();
  const ivory = new THREE.Color(0xefe6d2);
  return {
    count: steps.length,
    /** Element i: p = growth (0..1), glow = the landing flash, alpha = the reset fade. */
    set(i: number, p: number, glow: number, alpha = 1) {
      const pt = parts[i];
      const k = Math.max(p, 0.0001);
      pt.im.visible = p > 0.001 && alpha > 0.002;
      m.compose(pt.pos, pt.q, k3.set(pt.sc.x, pt.sc.y * k, pt.sc.z));
      pt.im.setMatrixAt(0, m);
      pt.im.instanceMatrix.needsUpdate = true;
      pt.mat.emissive.copy(ivory).multiplyScalar(0.4 * glow);
      pt.mat.opacity = alpha;
      pt.mat.depthWrite = alpha > 0.98;
      (pt.mat.userData.u as { uLit: { value: number } }).uLit.value = 0.55 * Math.min(1, Math.max(0, (p - 0.6) / 0.4));
    },
    dispose() {
      parts.forEach((p) => p.st.dispose());
    },
  };
}
export type Riser = ReturnType<typeof riser>;

/** The basalt ground: a big sphere with the site's basalt surface, darkened near the eye so the
 *  foreground sinks into the page ground. `near`: [dark until, full by] view distance. */
export function groundSphere(sf: Surface, scale: number, seg: number, near: [number, number]) {
  const mat = surfaceMaterial('basalt', scale, { color: 0x6c737b, roughness: 0.84, metalness: 0.05, clearcoat: 0.0, specularIntensity: 0.3, envMapIntensity: 0.7 });
  const prev = mat.onBeforeCompile;
  const shade = { uNear: { value: near[0] }, uFar: { value: near[1] } };
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, shade);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNear;uniform float uFar;')
      .replace('#include <opaque_fragment>', 'outgoingLight*=mix(.16,1.,smoothstep(uNear,uFar,length(vViewPosition)));\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'bw-ground';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(sf.R, seg, seg / 2), mat);
  mesh.position.copy(sf.C);
  return mesh;
}

/** A thin copper atmosphere shell (additive, back faces): brightest just above the surface and on
 *  the lit side. H: scale height; gain; shell radius in R. */
export function atmosphere(C: THREE.Vector3, R: number, H: number, gain: number, key: THREE.Vector3, shellR = 1.25) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uC: { value: C.clone() },
      uR: { value: R },
      uH: { value: H },
      uG: { value: gain },
      uCol: { value: COPPER.clone() },
      uKey: { value: key.clone() },
    },
    vertexShader: `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform vec3 uC;uniform float uR;uniform float uH;uniform float uG;uniform vec3 uCol;uniform vec3 uKey;varying vec3 vW;
void main(){vec3 ro=cameraPosition,rd=normalize(vW-ro);vec3 oc=uC-ro;float tc=dot(oc,rd);
float b=tc>0.?length(oc-rd*tc):length(oc);
if(b<uR*.9995)discard;
float e=(b-uR)/uH;
vec3 p=ro+rd*max(tc,0.);vec3 n=normalize(p-uC);
float sun=.25+.75*smoothstep(-.35,.55,dot(n,uKey));
float g=(exp(-e*5.)*.9+exp(-e*1.2)*.16)*sun;
gl_FragColor=vec4(uCol*g*uG,1.);}`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: ADD,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R * shellR, 160, 80), mat);
  mesh.position.copy(C);
  mesh.renderOrder = 2;
  return mesh;
}

