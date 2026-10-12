import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/**
 * The Formation craft kit (ticket #13): the chevron craft, glow sprites and vertex-colour
 * trails that draw the team everywhere it appears — the scroll story (formation-scene.ts)
 * and the stage's per-moon mission formations (map-scene.ts).
 *
 * A kit mounts everything under `parent`. formation-scene passes its scene root; map-scene
 * passes a bucket's formation anchor, a group that follows its moon. Because `orientCrafts`
 * billboards from world positions, the parent must keep an identity rotation and uniform
 * scale — positions may move freely. Every material is `fog: false`: formation-scene has no
 * fog, and map-scene's FogExp2 must not tint additive light.
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

/* ======================================================================================
   Micro-formations: each engagement moon's mission, flown live around the visible body
   (ticket #13, Brandon's Oct 12 direction: "the different moons are the different work
   buckets and each formation around each moon is different because each moon is a
   different mission"). Each mounts under an identity-rotation anchor group that map-scene
   keeps synced to its moon's position and scale; map-scene drives `tick(t, dir)` from its
   own clock (so Pause and reduced motion freeze them) and passes the orbit's world travel
   direction, which the choreography uses as its forward axis. Gains sit low — craft ≤1.9,
   trail colour ≤0.9, under the 0.93 bloom threshold — so small lights stay crisp instead
   of blobbing.
   ====================================================================================== */

export interface MicroFormation {
  tick(t: number, dir: THREE.Vector3): void;
  /** 0..1 visibility: the mission fades in as the selection flight focuses its moon
   *  (Brandon, 2026-10-12 round 5) and is absent from the wide planet-and-moons view. */
  setFade(f: number): void;
  setResolution(w: number, h: number): void;
  dispose(): void;
}

/** index 0 full-time: the line-abreast row sweeping one shared circuit around its moon.
 *  1 fractional: the wedge climbing a spiral around its moon, the copper guide off its
 *  wing. 2 advisory: loop-the-loops riding a slow circuit, the copper observer steady in
 *  high orbit above. `radius` is the body's bounding radius — the missions fly a
 *  1.4–1.7r band around it, clear of the surface, so each moon reads as a world with its
 *  team at work. */
export function attachMicroFormation(
  anchor: THREE.Object3D,
  camera: THREE.Camera,
  index: 0 | 1 | 2,
  radius: number,
): MicroFormation {
  const kit = makeCraftKit(anchor, camera);
  const r = radius;
  const f = new THREE.Vector3(0, 0, 1), // forward (travel), replaced every tick
    u = new THREE.Vector3(0, 1, 0), // up, kept roughly world-up and ⊥ f
    sv = new THREE.Vector3(1, 0, 0); // side = f × u
  const basis = (dir: THREE.Vector3) => {
    f.copy(dir).normalize();
    u.set(0, 1, 0).addScaledVector(f, -f.y).normalize();
    sv.copy(f).cross(u).normalize();
  };
  const P = (a: number, b: number, c: number, out: THREE.Vector3) =>
    out.set(0, 0, 0).addScaledVector(f, a).addScaledVector(u, b).addScaledVector(sv, c);

  type Flier = { craft: Craft; line: ReturnType<CraftKit['trail']>; pos(s: number, out: THREE.Vector3): void };
  const fliers: Flier[] = [];
  const N = 14, // trail points
    DH = 0.11; // seconds of history per point
  const _pt = new THREE.Vector3();
  let fade = 1;
  const tickTrails = (t: number) => {
    for (const fl of fliers) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        fl.pos(t - i * DH, _pt);
        pts.push(_pt.clone());
      }
      kit.place(fl.craft, pts);
      fl.craft.setOpacity(fade);
      kit.setTrail(fl.line, pts, RED, (fl.craft === copperRef ? 0.9 : 0.75) * fade, 1.1);
    }
    kit.orientCrafts();
  };
  const setVisible = (v: boolean) => {
    for (const fl of fliers) {
      fl.craft.group.visible = v;
      if (!v) fl.line.visible = false; // the next setTrail write re-shows it
    }
  };
  let copperRef: Craft | null = null;

  if (index === 0) {
    // Full time: five abreast sweeping one shared circuit around the moon — the team you
    // join, flying its mission together. The circuit stands in the forward–up plane, so
    // the row crosses in front of and behind its world as it works.
    const slots = [-0.62, -0.31, 0, 0.31, 0.62];
    const RC = 1.45 * r, // circuit radius, clear of the surface
      W = 0.55; // angular speed: one pass ≈ 11s of stage time
    slots.forEach((x, k) => {
      const copper = k === 2;
      const c = kit.craft(copper ? COPPER_DEEP : IVORY, (copper ? 0.46 : 0.3) * r, copper ? 1.9 : 1.35, true);
      if (copper) copperRef = c;
      const ph = k * 1.7;
      fliers.push({
        craft: c,
        line: kit.trail(1.3),
        pos(s, out) {
          P(RC * Math.sin(W * s), RC * Math.cos(W * s), x * r + 0.06 * r * Math.sin(s * 1.1 + ph), out);
        },
      });
    });
  } else if (index === 1) {
    // Fractional: the wedge climbs a deliberate spiral around the moon, rising and
    // settling; the copper guide flies the same line off its wing, ahead and above.
    const RC = 1.4 * r,
      W = 0.5,
      CLIMB = 0.5 * r;
    const helix = (s: number, lead: number, rad: number, lift: number, out: THREE.Vector3) => {
      const a = W * s + lead;
      P(rad * Math.sin(a), CLIMB * Math.sin(s * 0.35) + lift, rad * Math.cos(a), out);
    };
    // [angular lead (behind on the arc), radial offset, lift]
    const slots: [number, number, number][] = [
      [0, 0, 0],
      [-0.26, -0.1 * r, -0.06 * r],
      [-0.26, 0.1 * r, -0.06 * r],
    ];
    slots.forEach(([lead, rad, lift], k) => {
      const c = kit.craft(IVORY, 0.3 * r, 1.35, true);
      const ph = k * 1.3;
      fliers.push({
        craft: c,
        line: kit.trail(1.3),
        pos(s, out) {
          helix(s, lead, RC + rad, lift + 0.05 * r * Math.sin(s * 1.2 + ph), out);
        },
      });
    });
    const g = kit.craft(COPPER_DEEP, 0.46 * r, 1.9, true);
    copperRef = g;
    fliers.push({
      craft: g,
      line: kit.trail(1.4),
      pos(s, out) {
        helix(s, 0.3, RC + 0.18 * r, 0.22 * r, out);
      },
    });
  } else {
    // Advisory: the team loops in place — busy, going in circles — while drifting a slow
    // circuit around the moon; the copper observer holds high orbit, reviewing from
    // distance at half the team's drift.
    const RC = 1.4 * r,
      W = 0.3, // the slow circuit
      RHO = 0.3 * r,
      OMEGA = 1.4; // the loops themselves
    [0, 1, 2].forEach((k) => {
      const c = kit.craft(IVORY, 0.28 * r, 1.35, true);
      const ph = k * 0.55;
      fliers.push({
        craft: c,
        line: kit.trail(1.1),
        pos(s, out) {
          const a = W * s + k * 0.18;
          P(
            RC * Math.sin(a) + RHO * Math.sin(OMEGA * s + ph),
            RHO * (1 - Math.cos(OMEGA * s + ph)) - 0.2 * r,
            RC * Math.cos(a),
            out,
          );
        },
      });
    });
    const o = kit.craft(COPPER_DEEP, 0.42 * r, 1.9, true);
    copperRef = o;
    fliers.push({
      craft: o,
      line: kit.trail(1.1),
      pos(s, out) {
        const a = W * 0.5 * s;
        P(0.35 * r * Math.sin(a), 1.7 * r, 0.35 * r * Math.cos(a), out);
      },
    });
  }

  // The wide view opens clean: the mission only appears once the selection flight
  // brings its moon into focus.
  fade = 0;
  setVisible(false);

  return {
    tick(t, dir) {
      if (fade <= 0.001) return;
      basis(dir);
      tickTrails(t);
    },
    setFade(f) {
      const was = fade;
      fade = f;
      if (f <= 0.001 && was > 0.001) setVisible(false);
      else if (f > 0.001 && was <= 0.001) setVisible(true);
    },
    setResolution(w, h) {
      kit.setResolution(w, h);
    },
    dispose() {
      kit.dispose();
    },
  };
}
