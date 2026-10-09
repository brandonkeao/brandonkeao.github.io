// Fixed origin chips (copy pack hard rule: they never vary by context).
export const ORIGINS = {
  pie: 'Origin: full-time product role',
  ora: 'Origin: consulting-team role',
  bitly: 'Origin: full-time product role',
} as const;

export type StoryId = keyof typeof ORIGINS;
