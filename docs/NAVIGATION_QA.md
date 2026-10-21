# Navigation regression checks

Use Node 24 and install the locked dependencies with `npm ci`. Install the local browser once with `npx playwright install chromium`.

Build with `npm run build`, then run `npm run test:release`. It starts an isolated local preview, runs both browser suites and stops the preview. For iterative checks, start `npm run preview -- --host 127.0.0.1` and run `npm run test:navigation` or `npm run test:stage` in a second terminal. Set `SITE_URL` if the preview uses another local port. The scripts reject non-local hosts and block external HTTPS requests, including analytics and fonts.

The checks cover Portfolio and Playbooks selection, Back/Forward without document or canvas replacement, cross-page returns, the `html.js` marker after repeated Astro swaps, reduced motion, and readable content without JavaScript. Desktop and phone viewport cases run in Chromium. This is local browser evidence, not a hosted deployment or Safari certification.

`npm run test:stage` checks the current release design: Services deep links and selected content, browser history, phone-width selection, no-JavaScript choices, and the custom 404 page. The suite prints each result.

The collection's history hook only intercepts entries that match the current path and Astro document index. A prior visit to the same route belongs to Astro's router. The early hook in SiteHead must remain registered before Astro's popstate listener, and each collection clears its own hook when disposed.
