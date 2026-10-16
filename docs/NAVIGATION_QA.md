# Navigation regression checks

Use Node 22 and install the locked dependencies with `npm ci`. Install the local browser once with `npx playwright install chromium`.

Build with `npm run build`, start `npm run preview -- --host 127.0.0.1`, then run `npm run test:navigation` in a second terminal. Set `SITE_URL` if the preview uses another local port. The script rejects non-local hosts and blocks external HTTPS requests, including analytics and fonts.

The checks cover Portfolio and Playbooks selection, Back/Forward without document or canvas replacement, cross-page returns, the `html.js` marker after repeated Astro swaps, reduced motion, and readable content without JavaScript. Desktop and phone viewport cases run in Chromium. This is local browser evidence, not a hosted deployment or Safari certification.

Run `npm run test:stage` against the same preview for stage regressions: reduced motion without renderer downloads, no-WebGL and context-loss stills, collection canvas preservation, Home overflow at 1440/1280/390px, cross-page Forward with a rendered frame or visible poster, and a phone selection/switch with its stage offscreen. Set `RESULT_PATH` to save structured stage results; otherwise the script prints them only.

The collection's history hook only intercepts entries that match the current path and Astro document index. A prior visit to the same route belongs to Astro's router. The early hook in SiteHead must remain registered before Astro's popstate listener, and each collection clears its own hook when disposed.
