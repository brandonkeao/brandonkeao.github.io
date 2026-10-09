// Surface plate config shared by the hero landing (SurfaceLanding) and the scrolly story
// (SurfaceStory) — ticket #10. Plates are layered webp exports of the accepted renders; the
// focus targets are plate-space percentages of the features each story beat talks about,
// taken from the renderer's scene coordinates (1280×860 design space).
import type { EngagementSlug } from '../../../lib/orbit/orbit-data';

export type FocusKey = 'overview' | 'fits' | 'work' | 'together';
export interface Focus { x: number; y: number; zoom: number }
export interface Surface { plate: string; name: string; focus: Record<FocusKey, Focus> }

export const SURFACES: Record<EngagementSlug, Surface> = {
  'full-time': {
    plate: 'settlement',
    name: 'The settlement',
    focus: {
      overview: { x: 50, y: 50, zoom: 1.02 },
      fits: { x: 46.5, y: 50.5, zoom: 1.8 },      // the habitat hub
      work: { x: 65.2, y: 62.5, zoom: 1.8 },      // the workshop module
      together: { x: 62, y: 50, zoom: 1.45 },     // worn paths + greenhouse
    },
  },
  fractional: {
    plate: 'expedition',
    name: 'The expedition',
    focus: {
      overview: { x: 50, y: 50, zoom: 1.02 },
      fits: { x: 25.8, y: 75.5, zoom: 1.8 },      // the landing pad
      work: { x: 79, y: 31.5, zoom: 1.8 },        // the worksite
      together: { x: 54, y: 52.5, zoom: 1.5 },    // the route through the cache
    },
  },
  advisory: {
    plate: 'survey',
    name: 'The survey array',
    focus: {
      overview: { x: 50, y: 50, zoom: 1.02 },
      fits: { x: 21.8, y: 55, zoom: 1.8 },        // the control station
      work: { x: 54.7, y: 47, zoom: 1.6 },        // the triangulated array
      together: { x: 81.7, y: 65.5, zoom: 1.8 },  // the redeployable instrument
    },
  },
};

export const plateBase = (s: Surface) => `/images/orbit/surfaces/${s.plate}`;
