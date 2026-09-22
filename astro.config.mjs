// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://brandonkeao.com',
  // Local reviews must not reuse pages from an earlier build.
  server: {
    headers: { 'Cache-Control': 'no-store' }
  },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/writing')
    })
  ],
});
