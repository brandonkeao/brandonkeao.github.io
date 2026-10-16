/**
 * Pure placement for projected scene labels. A chip sits on the far side of
 * its body from the centre, joined by a short leader line; it is clamped to
 * the usable stage. On collision the count/meta line is dropped first, then
 * the chip moves outward, then sideways, then to the opposite side.
 */
export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Bounds = { left: number; right: number; top: number; bottom: number };
export type Placement = {
  rect: Rect;
  compact: boolean;
  leader: { x1: number; y1: number; x2: number; y2: number; visible: boolean };
};
export const LABEL_GAP = 4;
export const LEADER_LENGTH = 16;
const PAD = 6;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Usable chip area for a stage. The top is a reserved band under the stage
 * toolbar: at least the fixed minimum for the level, and at least the
 * measured toolbar bottom plus a gap. When the breadcrumb is present (inside
 * a collection) the gap is wider, and wider still on phones, where the
 * breadcrumb can wrap to two lines and child chips otherwise crowd under it.
 */
export function labelBounds(input: {
  width: number;
  height: number;
  /** Pixels held by the dock overlay at the bottom of the stage. */
  bottomReserve: number;
  /** Measured bottom edge of the stage toolbar (stage pixels), if known. */
  toolbarBottom?: number;
  breadcrumb: boolean;
}): Bounds {
  const compact = input.width < 600;
  const minimum = compact ? (input.breadcrumb ? 86 : 62) : 84;
  const gap = input.breadcrumb ? (compact ? 18 : 12) : 8;
  const band = input.toolbarBottom === undefined ? 0 : input.toolbarBottom + gap;
  return {
    left: 10,
    right: input.width - 10,
    top: Math.max(minimum, band),
    bottom: input.height - input.bottomReserve - 6,
  };
}

export function rectsOverlap(a: Rect, b: Rect, pad = PAD) {
  return (
    a.x < b.x + b.w + pad &&
    b.x < a.x + a.w + pad &&
    a.y < b.y + b.h + pad &&
    b.y < a.y + a.h + pad
  );
}
export function rectHitsCircle(r: Rect, c: Point, radius: number) {
  const px = clamp(c.x, r.x, r.x + r.w),
    py = clamp(c.y, r.y, r.y + r.h);
  return Math.hypot(px - c.x, py - c.y) < radius;
}

/** Overlap area of two rects, each grown by `pad` on one side (as rectsOverlap). */
export function overlapArea(a: Rect, b: Rect, pad = PAD) {
  const w = Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
/** How far a circle reaches into a rect (0 when they do not touch). */
function circleDepth(r: Rect, c: Point, radius: number) {
  const px = clamp(c.x, r.x, r.x + r.w),
    py = clamp(c.y, r.y, r.y + r.h);
  return Math.max(0, radius - Math.hypot(px - c.x, py - c.y));
}

export function placeLabel(input: {
  anchor: Point;
  center: Point;
  radius: number;
  full: Size;
  compact: Size;
  bounds: Bounds;
  placed: Rect[];
  /** Circles a chip must not cover, e.g. the central body and its title. */
  obstacles?: { x: number; y: number; r: number }[];
}): Placement {
  const { anchor, center, radius, bounds, placed } = input;
  const obstacles = input.obstacles ?? [];
  const dx = anchor.x - center.x,
    dy = anchor.y - center.y,
    len = Math.hypot(dx, dy);
  const out: Point = len < 1 ? { x: 0, y: -1 } : { x: dx / len, y: dy / len };

  function candidate(size: Size, d: Point, extra: number, side = 0) {
    const ax = anchor.x + d.x * (radius + LABEL_GAP),
      ay = anchor.y + d.y * (radius + LABEL_GAP);
    const bx = ax + d.x * (LEADER_LENGTH + extra) - d.y * side,
      by = ay + d.y * (LEADER_LENGTH + extra) + d.x * side;
    const cx = bx + clamp(2 * d.x, -1, 1) * (size.w / 2),
      cy = by + clamp(2 * d.y, -1, 1) * (size.h / 2);
    const rect: Rect = {
      x: clamp(cx - size.w / 2, bounds.left, Math.max(bounds.left, bounds.right - size.w)),
      y: clamp(cy - size.h / 2, bounds.top, Math.max(bounds.top, bounds.bottom - size.h)),
      w: size.w,
      h: size.h,
    };
    return { rect, start: { x: ax, y: ay } };
  }
  const flipped = { x: -out.x, y: -out.y };
  const tries: [Size, Point, number, number, boolean][] = [
    [input.full, out, 0, 0, false],
    [input.compact, out, 0, 0, true],
    [input.compact, out, 18, 0, true],
    [input.compact, out, 36, 0, true],
    [input.compact, out, 0, input.compact.h + PAD, true],
    [input.compact, out, 0, -(input.compact.h + PAD), true],
    [input.compact, out, 0, 2 * (input.compact.h + PAD), true],
    [input.compact, out, 0, -2 * (input.compact.h + PAD), true],
    [input.compact, flipped, 0, 0, true],
  ];
  let chosen: { rect: Rect; start: Point; compact: boolean } | null = null;
  for (const [size, d, extra, side, compact] of tries) {
    const c = candidate(size, d, extra, side);
    if (
      !placed.some((p) => rectsOverlap(c.rect, p)) &&
      !rectHitsCircle(c.rect, anchor, radius + 2) &&
      !obstacles.some((o) => rectHitsCircle(c.rect, o, o.r))
    ) {
      chosen = { ...c, compact };
      break;
    }
  }
  if (!chosen) {
    // Crowded stage (small phones, inside a collection): nothing is fully
    // clear. Take the least-bad spot instead of the first one: covering
    // another chip is worst (both become unreadable), covering the chip's own
    // body next, grazing an obstacle (centre world, former centre) least.
    // A small grid around the body on both sides: outward/inward, with
    // sideways shifts of up to four chip heights and two extra leader lengths.
    // Earlier entries win ties, so the nearest spot is preferred.
    const step = input.compact.h + PAD;
    const fallbacks: [Point, number, number][] = [];
    for (const d of [out, flipped])
      for (const extra of [0, 36, 72])
        for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4]) fallbacks.push([d, extra, k * step]);
    let best = Infinity;
    for (const [d, extra, side] of fallbacks) {
      const c = candidate(input.compact, d, extra, side);
      let cost = 0;
      for (const p of placed) cost += 1000 * overlapArea(c.rect, p, PAD);
      if (rectHitsCircle(c.rect, anchor, radius + 2)) cost += 200000;
      // Pixels of intrusion into the centre world / former centre.
      for (const o of obstacles) cost += 300 * circleDepth(c.rect, o, o.r);
      // Mild preference for short leaders.
      cost += Math.abs(side) * 0.5 + extra;
      if (cost < best) {
        best = cost;
        chosen = { ...c, compact: true };
      }
    }
  }
  if (!chosen) chosen = { ...candidate(input.compact, out, 0), compact: true };
  const r = chosen.rect;
  const x2 = clamp(chosen.start.x, r.x, r.x + r.w),
    y2 = clamp(chosen.start.y, r.y, r.y + r.h);
  return {
    rect: r,
    compact: chosen.compact,
    leader: {
      x1: chosen.start.x,
      y1: chosen.start.y,
      x2,
      y2,
      visible: Math.hypot(x2 - chosen.start.x, y2 - chosen.start.y) > 3,
    },
  };
}
