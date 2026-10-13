/**
 * Geometry for the stretched title-line marks that are not `align` (Brandon, 2026-10-13:
 * Portfolio and Playbooks each get their own line). Shared by MotionLine's server markup
 * (the no-JS default at 720 wide) and its script (rebuilt to the container width).
 * All coordinates are in a W × 40 viewBox.
 */

/** `record` (Portfolio): three shallow arcs land on stacked lines; the newest is lowest and longest. */
export function recordGeometry(W: number) {
  const a = Math.min(140, Math.round(W * 0.24)); // where each arc touches down
  const lines = [
    { key: 'r0', y: 12, end: Math.round(W * 0.64) },
    { key: 'r1', y: 21, end: Math.round(W * 0.82) },
    { key: 'r2', y: 30, end: W - 4 },
  ];
  const d: Record<string, string> = {};
  for (const l of lines) d[l.key] = `M 1 ${l.y - 10} Q ${Math.round(a * 0.5)} ${l.y} ${a} ${l.y} H ${l.end}`;
  return { a, d, head: { cx: W - 4, cy: 30 }, straight: W - 4 - a };
}

/** `route` (Playbooks): one gentle path with two bends — planned (dashed), then flown (solid). */
export function routeGeometry(W: number) {
  const c = Math.min(36, Math.round(W * 0.08));
  const b1 = Math.round(W * 0.3);
  const b2 = Math.round(W * 0.66);
  const d = `M 1 28 H ${b1 - c} C ${b1} 28 ${b1} 12 ${b1 + c} 12 H ${b2 - c} C ${b2} 12 ${b2} 22 ${b2 + c} 22 H ${W - 2}`;
  // Bend midpoints (where the curves cross half their rise) and the tangent there.
  const bends = [
    { x: b1, y: 20, dx: 0.75 * 2 * c, dy: -16 * 1.5 },
    { x: b2, y: 17, dx: 0.75 * 2 * c, dy: 10 * 1.5 },
  ];
  // A short tick across the path at each bend (the Maneuver's burns): 10 units, perpendicular.
  const ticks = bends.map(({ x, y, dx, dy }) => {
    const n = Math.hypot(dx, dy) || 1;
    const nx = (-dy / n) * 5, ny = (dx / n) * 5;
    return `M ${(x - nx).toFixed(1)} ${(y - ny).toFixed(1)} L ${(x + nx).toFixed(1)} ${(y + ny).toFixed(1)}`;
  });
  return { d, ticks, bendX: [b1, b2] };
}
