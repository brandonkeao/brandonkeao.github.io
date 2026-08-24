---
project: brandonkeao.com
initiative: website-v2
status: active-development
branch: website-v2
last_updated: 2026-08-23
tech_stack: [Astro 5.x, Tailwind CSS 4.x, TypeScript]
deployment: GitHub Pages
domain: brandonkeao.com
---

# brandonkeao.com — Website V2

## Objective

Develop the next version of Brandon's professional website without disrupting the live site. The site should support consulting opportunities and senior product-leadership roles while preserving Brandon's original voice, leadership philosophy, writing archive, and useful public history.

## Current thesis

Brandon is a senior product and growth operator for important business problems that cross functional boundaries. Product, Growth, Data, Engineering, Operations, and AI are capabilities he connects around one outcome, not separate consulting identities.

This remains a working thesis until Brandon approves the public positioning.

## Content authority

See [`docs/CONTENT_PRECEDENCE.md`](docs/CONTENT_PRECEDENCE.md).

1. Original website content.
2. Current context and goal.
3. Current website content as fallback.

Use [`docs/WRITING_STYLE.md`](docs/WRITING_STYLE.md) for the website register.

## Audiences

- Leaders exploring product strategy, discovery, or fractional product leadership.
- Hiring executives evaluating Brandon for senior product and cross-functional leadership roles.
- Product leaders, builders, and collaborators evaluating how Brandon thinks and works.

## Current routes

| Route | V2 state |
|---|---|
| `/` | Rebuilt around original positioning and current goal |
| `/about/` | Rebuilt around builder-first career story |
| `/services/` | Original service model restored and adapted |
| `/manager-readme/` | Full January 3 pre-Astro copy restored |
| `/writing/` | Existing archive preserved but removed from site navigation until curation is ready |
| `/bookshelf/` | Existing content preserved; review pending |
| `/contact/` | Existing implementation preserved; conversion review pending |
| `/projects/` | Existing implementation preserved; evidence and architecture review pending |

## Design direction

- editorial, senior, warm, and technically literate;
- warm paper, dark ink, and terracotta accent;
- strong serif headlines and visible section structure;
- minimal imagery and restrained motion;
- responsive layouts with accessible focus, navigation, and reduced-motion behavior.

## Review gates

Brandon must approve before publication:

- final positioning and audience priority;
- career metrics and company claims;
- testimonials and public-use permission;
- service names, scope, pricing, and availability;
- current personal and employer details;
- case-study framing and confidentiality;
- archive, redirect, analytics, and launch decisions.

## Safety boundary

The `website-v2` branch is local development. Do not merge, push, publish, alter GitHub Pages, change DNS, or remove historical routes without explicit approval.

## Verification

- `npm run build` must complete before review handoff.
- Review homepage, Services, About, Manager README, and mobile navigation locally.
- Validate content provenance and public claims before deployment work begins.
