# Website V2 Agent Instructions

This branch is a content-led evolution of `brandonkeao.com`.

This repository owns website implementation; project intent and accepted design decisions live in its owning context when available. In a Brandon OS checkout, find that context through the workspace registry. This independent Git root does not automatically inherit the operating parent's instructions.

Run `npm run build` for relevant Astro/source changes; use `npm run dev` for local review. Documentation-only changes do not require a deployment or full app build. Preserve uncommitted work and keep runtime checks distinct from publication.

At session end, update accepted project context, status and decisions in their owning home and this repository's instructions only when future behavior changes. When available, use the shared `close-session` skill; otherwise follow the same update, validate, and scoped-commit workflow. Preserve unrelated changes, keep private context out of this public repository, and report commit/push state separately. The publication restrictions below still apply.

Before changing public copy:

1. Read [`docs/CONTENT_PRECEDENCE.md`](docs/CONTENT_PRECEDENCE.md).
2. Read [`docs/WRITING_STYLE.md`](docs/WRITING_STYLE.md).
3. Preserve the current Astro architecture, route history, and public URLs unless a reviewed decision says otherwise.
4. Treat the `website-v2` branch as development work. Do not publish, merge, or push without Brandon's explicit approval.
5. Do not turn historical summaries into verbatim quotations.
6. Keep claims, testimonials, prices, availability, employer details, and personal facts behind a review gate.

Content precedence:

1. Original website content.
2. Current goal and direction.
3. Current website content as fallback.
