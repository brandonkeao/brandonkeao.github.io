import * as THREE from 'three';

/**
 * Far star dust and the frame edge fade that keeps it off the stage box (Brandon, 2026-10-13:
 * "we should have stars included in all the animation backgrounds"). Factored out of the
 * collection scenes (ticket #16), which carried both first; used there, by the orbital map
 * stage (Home, Work with me) and by the Work with me story scenes.
 *
 * The dust is a seeded shell of fixed-size points, below the bloom threshold, unfogged, with
 * depth testing on and depth writes off, so every body and trail draws over it.
 */

export interface StarDustOptions {
  /** Points on the shell (collections: 900). */
  count?: number;
  /** Point size in CSS px; sizeAttenuation is off, so this is the on-screen size. */
  size?: number;
  opacity?: number;
  color?: THREE.ColorRepresentation;
  /** Shell radii (world units); keep `outer` plus the camera's reach under the camera's far plane. */
  inner?: number;
  outer?: number;
  /** PRNG seed, so posters are repeatable. */
  seed?: number;
}

export interface StarDust {
  points: THREE.Points;
  count: number;
  dispose(): void;
}

/** The collection scenes' look: 900 points, 1.4px, warm grey #8a877d at 0.55, shell 60–90. */
export const STAR_DUST_DEFAULTS: Required<StarDustOptions> = {
  count: 900, size: 1.4, opacity: 0.55, color: 0x8a877d, inner: 60, outer: 90, seed: 7,
};

export function addStarDust(scene: THREE.Object3D, opts: StarDustOptions = {}): StarDust {
  const o = { ...STAR_DUST_DEFAULTS, ...opts };
  const pos = new Float32Array(o.count * 3);
  let seed = o.seed;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const v = new THREE.Vector3();
  for (let i = 0; i < o.count; i++) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(o.inner + rnd() * (o.outer - o.inner));
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: o.color, size: o.size, sizeAttenuation: false, transparent: true, opacity: o.opacity, depthWrite: false, fog: false,
  });
  const points = new THREE.Points(g, m);
  scene.add(points);
  return {
    points,
    count: o.count,
    dispose() {
      points.removeFromParent();
      g.dispose();
      m.dispose();
    },
  };
}

/** The page ground in output (sRGB) space: what STAGE_GROUND tone-maps to, pixel-exact. */
const GROUND_OUT = new THREE.Vector3(43 / 255, 45 / 255, 41 / 255);

/**
 * Final ShaderPass: the outer frame blends to the page ground — hard `uHard`, then a `uSoft`
 * ramp, in drawing-buffer px (call `setEdgeFade` on resize with the pixel ratio applied).
 * So bloom, coronas and the dust never tint the stage box's edge.
 */
export const EdgeFeather = {
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

/** Size the edge fade for a w × h CSS-px box at pixel ratio `pr`: 10px hard + 40px soft. */
export function setEdgeFade(pass: { uniforms: Record<string, { value: any }> }, w: number, h: number, pr: number) {
  pass.uniforms.uRes.value.set(w * pr, h * pr);
  pass.uniforms.uHard.value = 10 * pr;
  pass.uniforms.uSoft.value = 40 * pr;
}
