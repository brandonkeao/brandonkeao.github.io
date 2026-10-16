// Fixed origin chips (copy pack hard rule: they never vary by context).
export const ORIGINS = {
  rebrandly: 'Origin: fractional consulting, then full-time leadership',
  pairin: 'Origin: full-time product leadership',
  pie: 'Origin: full-time product role',
  ora: 'Origin: consulting-team role',
  bitly: 'Origin: full-time product role',
} as const;

export type StoryId = keyof typeof ORIGINS;
