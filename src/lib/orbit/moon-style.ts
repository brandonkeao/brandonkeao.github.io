/**
 * Moon style: a review switch for how the three worlds are drawn.
 *
 * - `spheres` (default since 2026-09-30, Brandon: "Three spheres looks
 *   best"): all three are spherical moons. Playbooks is the rust moon;
 *   Portfolio is a slightly larger basalt moon, Approach a slightly smaller,
 *   paler ivory/copper-dust moon.
 * - `shapes` (`?moons=shapes`): the earlier look. Portfolio is a brushed
 *   graphite rounded cube, Playbooks the rust sphere, Approach a graphite
 *   octahedron.
 * - `detailed`: the cube and octahedron keep their geometry but gain
 *   procedural surface relief, cracks, worn edges and copper veins.
 *
 * Resolved once at startup from `window.__LIVING_MAP_MOON_STYLE`, then a
 * `?moons=` URL query, else DEFAULT_MOON_STYLE. Unknown values fall through.
 */
export type MoonStyle = 'shapes' | 'spheres' | 'detailed';
export const DEFAULT_MOON_STYLE: MoonStyle = 'spheres';
export const MOON_STYLES: readonly MoonStyle[] = ['shapes', 'spheres', 'detailed'];

function valid(value: unknown): MoonStyle | null {
  return typeof value === 'string' && (MOON_STYLES as readonly string[]).includes(value)
    ? (value as MoonStyle)
    : null;
}

/** Pure resolution, for tests: injected global first, then the query string. */
export function parseMoonStyle(injected: unknown, search: string | null | undefined): MoonStyle {
  const fromGlobal = valid(injected);
  if (fromGlobal) return fromGlobal;
  try {
    const fromQuery = valid(new URLSearchParams(search ?? '').get('moons'));
    if (fromQuery) return fromQuery;
  } catch {
    // Malformed query: keep the default.
  }
  return DEFAULT_MOON_STYLE;
}

export function resolveMoonStyle(): MoonStyle {
  if (typeof window === 'undefined') return DEFAULT_MOON_STYLE;
  let injected: unknown;
  let search = '';
  try {
    injected = (window as unknown as { __LIVING_MAP_MOON_STYLE?: unknown }).__LIVING_MAP_MOON_STYLE;
    search = window.location.search;
  } catch {
    // Opaque frames may refuse location access.
  }
  return parseMoonStyle(injected, search);
}

/**
 * Sphere radii (before MOON_SCALE) for the `spheres` style (mirrored as
 * SPHERE_BODY_RADII in lib/orbits.ts, which sizes the orbits around them), and the radius a
 * centred sphere reaches in a collection (world units). Playbooks keeps its
 * 0.29 sphere and its existing centred size (0.29 x 4.7).
 */
export const SPHERE_RADII: [number, number, number] = [0.33, 0.29, 0.255];
export const SPHERE_CENTER_RADII: [number, number, number] = [1.4, 0.29 * 4.7, 1.3];
