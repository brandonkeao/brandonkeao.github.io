import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/**
 * The Formation craft kit (ticket #13): the chevron craft, glow sprites and vertex-colour
 * trails that draw the team everywhere it appears — the scroll story and establishing shot
 * (formation-scene.ts) and the wide stage's micro-formation buckets (map-scene.ts).
 *
 * A kit mounts everything under `parent`. formation-scene passes its scene root; map-scene
 * passes a bucket's proxy mesh, which orbits. Because `orientCrafts` billboards from world
 * positions, the parent must keep an identity rotation and uniform scale — positions may
 * move freely. Every material is `fog: false`: formation-scene has no fog, and map-scene's
 * FogExp2 must not tint additive light.
 */

/* ---- the formation's palette ---- */
export const RED = new THREE.Color(0xf16b65);
export const IVORY = new THREE.Color(0xefe6d2);
// Brandon's craft wears a deeper copper: at bloom gain the plain copper whites out and he
// vanishes into the team (review round 1, art director / PM).
export const COPPER_DEEP = new THREE.Color(0xf29a56);

const ADD = THREE.AdditiveBlending;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A craft: the accepted chevron — a flat arrowhead of light that always points where it
 *  flies — or, unstyled, a bare glow (burn glows, observer dots). */
export interface Craft {
  group: THREE.Group;
  aim: THREE.Group | null;
  dir: THREE.Vector3;
  faceCamera: boolean;
  setOpacity(o: number): void;
}

export interface CraftKit {
  craft(color: THREE.Color, size?: number, gain?: number, styled?: boolean): Craft;
  /** Place a craft at the head of its trail and remember its heading. */
  place(c: Craft, pts: THREE.Vector3[]): void;
  /** Billboard styled crafts toward the camera (world-space; see the parent constraint). */
  orientCrafts(): void;
  trail(width?: number): Line2;
  /** Write a polyline; head is pts[0]. Colour fades along the tail; `gain` lets the
   *  brightest part bloom. */
  setTrail(line: Line2, pts: THREE.Vector3[], color: THREE.Color, gain: number, fadePow?: number): void;
  staticLine(pts: THREE.Vector3[], color: number, alpha: number, width?: number, dashed?: boolean): Line2;
  glowTex: THREE.CanvasTexture;
  lineMats: LineMaterial[];
  setResolution(w: number, h: number): void;
  dispose(): void;
}

export function makeCraftKit(parent: THREE.Object3D, camera: THREE.Camera): CraftKit {
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.12, 'rgba(255,255,255,.95)');
    r.addColorStop(0.3, 'rgba(255,255,255,.28)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const crafts: Craft[] = [];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const lines: Line2[] = [];
  const lineMats: LineMaterial[] = [];

  function craft(color: THREE.Color, size = 0.2, gain = 2.2, styled = false): Craft {
    const group = new THREE.Group();
    const parts: THREE.Material[] = [];
    const sprite = (host: THREE.Object3D, sc: number, gn: number, base = 1) => {
      const m = new THREE.SpriteMaterial({
        map: glowTex,
        color: color.clone().multiplyScalar(gn),
        transparent: true,
        depthWrite: false,
        blending: ADD,
        fog: false,
      });
      m.userData.base = base;
      parts.push(m);
      materials.push(m);
      const sp = new THREE.Sprite(m);
      sp.scale.setScalar(sc);
      host.add(sp);
      return sp;
    };
    let aim: THREE.Group | null = null;
    if (styled) {
      const k = size / 0.2;
      aim = new THREE.Group();
      group.add(aim);
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.075 * k);
      sh.lineTo(0.06 * k, -0.05 * k);
      sh.lineTo(0, -0.022 * k);
      sh.lineTo(-0.06 * k, -0.05 * k);
      sh.closePath();
      const m = new THREE.MeshBasicMaterial({
        color: color.clone().multiplyScalar(gain * 0.9),
        transparent: true,
        depthWrite: false,
        blending: ADD,
        side: THREE.DoubleSide,
        fog: false,
      });
      m.userData.base = 1;
      parts.push(m);
      materials.push(m);
      const geo = new THREE.ShapeGeometry(sh);
      geometries.push(geo);
      aim.add(new THREE.Mesh(geo, m));
      sprite(group, size * 0.6, gain * 0.35);
    } else {
      sprite(group, size, gain);
    }
    const c: Craft = {
      group,
      aim,
      dir: V(0, 0, 1),
      faceCamera: styled,
      setOpacity(o) {
        for (const m of parts) m.opacity = (m.userData.base ?? 1) * o;
      },
    };
    parent.add(group);
    crafts.push(c);
    return c;
  }

  function place(c: Craft, pts: THREE.Vector3[]) {
    c.group.position.copy(pts[0]);
    if (pts.length > 1) {
      const d = pts[0].clone().sub(pts[1]);
      if (d.lengthSq() > 1e-10) c.dir.copy(d.normalize());
    }
  }

  const _x = V(),
    _z = V(),
    _wp = V(),
    _cp = V(),
    _m = new THREE.Matrix4(),
    _up = V(0, 1, 0);
  function orientCrafts() {
    camera.getWorldPosition(_cp);
    for (const c of crafts) {
      if (!c.aim) continue;
      if (c.faceCamera) {
        // forward = travel, face = towards the camera
        c.group.getWorldPosition(_wp);
        _z.copy(_cp).sub(_wp).normalize();
        _x.copy(c.dir).cross(_z);
        if (_x.lengthSq() < 1e-8) continue;
        _x.normalize();
        _z.copy(_x).cross(c.dir).normalize();
        c.aim.quaternion.setFromRotationMatrix(_m.makeBasis(_x, c.dir, _z));
      } else c.aim.quaternion.setFromUnitVectors(_up, c.dir);
    }
  }

  function trail(width = 2.2) {
    const mat = new LineMaterial({
      color: 0xffffff,
      linewidth: width,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: ADD,
      worldUnits: false,
      fog: false,
    });
    lineMats.push(mat);
    materials.push(mat);
    const line = new Line2(new LineGeometry(), mat);
    line.frustumCulled = false;
    parent.add(line);
    lines.push(line);
    return line;
  }

  function setTrail(line: Line2, pts: THREE.Vector3[], color: THREE.Color, gain: number, fadePow = 1.3) {
    if (pts.length < 2 || gain <= 0.001) {
      line.visible = false;
      return;
    }
    line.visible = true;
    const p = new Float32Array(pts.length * 3),
      c = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      const a = gain * Math.pow(1 - i / (pts.length - 1), fadePow);
      p.set([pts[i].x, pts[i].y, pts[i].z], i * 3);
      c.set([color.r * a, color.g * a, color.b * a], i * 3);
    }
    line.geometry.dispose();
    line.geometry = new LineGeometry();
    line.geometry.setPositions(p);
    line.geometry.setColors(c);
  }

  function staticLine(pts: THREE.Vector3[], color: number, alpha: number, width = 1.2, dashed = false) {
    const mat = new LineMaterial({
      color,
      linewidth: width,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
      dashed,
      dashSize: 0.08,
      gapSize: 0.1,
      worldUnits: false,
      fog: false,
    });
    lineMats.push(mat);
    materials.push(mat);
    const g = new LineGeometry();
    g.setPositions(pts.flatMap((v) => [v.x, v.y, v.z]));
    const l = new Line2(g, mat);
    if (dashed) l.computeLineDistances();
    l.frustumCulled = false;
    parent.add(l);
    lines.push(l);
    return l;
  }

  return {
    craft,
    place,
    orientCrafts,
    trail,
    setTrail,
    staticLine,
    glowTex,
    lineMats,
    setResolution(w, h) {
      for (const m of lineMats) m.resolution.set(w, h);
    },
    dispose() {
      for (const l of lines) {
        l.geometry.dispose();
        l.removeFromParent();
      }
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const c of crafts) c.group.removeFromParent();
      glowTex.dispose();
      crafts.length = lines.length = geometries.length = materials.length = lineMats.length = 0;
    },
  };
}
