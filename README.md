# brandonkeao.com — Website V2

This is the isolated development copy of Brandon Keao's personal website. It preserves the live repository's Git history while developing the next version on the `website-v2` branch.

The live site is not changed by work in this folder.

## Content order

1. Original website content.
2. Current goal and direction.
3. Current website content as fallback.

Read [`docs/CONTENT_PRECEDENCE.md`](docs/CONTENT_PRECEDENCE.md) before changing copy. Use [`docs/WRITING_STYLE.md`](docs/WRITING_STYLE.md) as the working website voice standard.

## Current V2 scope

- editorial homepage based on the reviewed visual direction;
- homepage repositioned around senior product leadership for problems that do not stay inside Product;
- original consultation, assessment, and Fractional Head of Product model restored;
- full pre-Astro Manager README restored;
- About page updated so AI supports the career story rather than replacing it;
- Bookshelf restored to primary navigation and homepage discovery;
- Writing routes preserved but hidden from navigation until the editorial review is ready;
- existing Contact, Projects, and archive routes preserved as fallbacks pending review.

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
