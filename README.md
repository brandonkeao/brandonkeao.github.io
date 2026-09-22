# brandonkeao.com — Website V2

This is the isolated development copy of Brandon Keao's personal website. It preserves the live repository's Git history while developing the next version on the `website-v2` branch.

The live site is not changed by work in this folder.

## Content order

1. Original website content.
2. Current goal and direction.
3. Current website content as fallback.

Read [`docs/CONTENT_PRECEDENCE.md`](docs/CONTENT_PRECEDENCE.md) before changing copy. Use [`docs/WRITING_STYLE.md`](docs/WRITING_STYLE.md) as the working website voice standard.

## Current site

- `/`: broad professional homepage with the reviewed product-leadership story.
- `/consulting/`: dedicated landing page with its own wordmark header and contact CTA.
- `/services/`, `/manager-readme/`, `/bookshelf/`, `/about/`, and `/contact/`: supporting pages with shared navigation.
- `/projects/` and all `/writing/` routes remain available. Writing is excluded from primary discovery and the sitemap.

See [September 22 release notes](docs/RELEASE_2026_09_22.md) for cleanup, mobile QA, and the remaining toolchain maintenance.

## Local review

```sh
npm ci
npm run dev
```

Astro will print the local review address. The production build check is:

```sh
npm run build
```

## Publishing boundary

Do not merge, push, publish, or change DNS from this branch without Brandon's explicit approval. Metrics, testimonials, employer claims, service pricing, availability, and personal details require review before publication.
