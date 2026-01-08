---
project: brandonkeao.com
type: personal-website
status: active
version: 1.1.2
last_updated: 2026-01-07
tech_stack: [Astro 5.x, Tailwind CSS 4.x, TypeScript]
deployment: GitHub Pages
domain: brandonkeao.com
sections:
  - overview
  - requirements
  - design-system
  - architecture
  - qa-standards
  - changelog
pages: [home, about, services, writing, contact, bookshelf, manager-readme, projects]
components: [Header, Footer, Button, Card, Tag, ServiceCard, ProjectCard, PostCard, Testimonial]
---

# PROJECT.md - brandonkeao.com

Centralized project requirements, design decisions, and standards for Brandon Keao's personal website.

---

## Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Design System](#design-system)
4. [Technical Architecture](#technical-architecture)
5. [QA Standards](#qa-standards)
6. [Changelog](#changelog)

---

## Overview

### Project Summary

| Field | Value |
|-------|-------|
| **Domain** | brandonkeao.com |
| **Purpose** | Personal brand website for product leader + AI builder |
| **Status** | Active development |
| **Deployment** | GitHub Pages (automated via GitHub Actions) |

### Target Audience

- **Primary**: Potential consulting clients, collaborators
- **Secondary**: Hiring managers, product leaders seeking insight
- **Tertiary**: AI builders, context engineering enthusiasts

### Success Metrics

- Professional online presence established
- Clear service offerings communicated
- Thought leadership content accessible
- Lead generation via contact form

### Positioning

Brandon Keao: Product Leader. AI Builder.

> "Building the systems that build systems."

18+ years building products and teams. Now pioneering practical context engineering -- sharing the journey publicly.

---

## Requirements

### Site Architecture

**Primary Navigation:**
```
About | Work With Me | Writing | Manager README | Contact
```

**Footer Navigation:**
```
Bookshelf | LinkedIn
```

### Pages

| Page | URL | Purpose | Status |
|------|-----|---------|--------|
| **Home** | `/` | Hero, belief statement, featured projects, testimonials | Implemented |
| **About** | `/about/` | Full biographical narrative (~850 words) | Implemented |
| **Work With Me** | `/services/` | 3-tier service offerings | Implemented |
| **Writing** | `/writing/` | Blog listing with context engineering focus | Implemented |
| **Contact** | `/contact/` | Google Form embed for lead capture | Implemented (placeholder) |
| **Bookshelf** | `/bookshelf/` | Reading recommendations | Implemented |
| **Manager README** | `/manager-readme/` | Management philosophy and working style | Implemented |
| **Projects** | `/projects/` | Portfolio of technical work (Jane, Agentic OS) | Implemented |

### Content Strategy

**Core Themes:**
- Context engineering (not prompt engineering)
- Practical AI systems building
- Product leadership and team development
- Building in public

**Voice Guidelines:**
- Use double hyphens (--) instead of em dashes
- Direct and pragmatic tone
- First person perspective
- Practical over theoretical

**Content Sources:**
- `/Users/brandonkeao/AI Workspaces v4/personal_branding/projects/website_redesign/FINAL_CONTENT_PACKAGE.md`

### Blog Content

17 blog posts covering:
- Product management philosophy
- Technology and innovation
- Leadership and personal development
- AI and context engineering

Content collection location: `src/content/writing/`

---

## Design System

### Typography

**Font Families:**
| Purpose | Font | Fallback |
|---------|------|----------|
| Body | Inter | system-ui, -apple-system, sans-serif |
| Headlines | Source Serif 4 | Georgia, Times New Roman, serif |
| Code | JetBrains Mono | ui-monospace, Menlo, Monaco |

**Type Scale (Major Third 1.25x):**
| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 0.8rem | Tags, meta |
| `--text-sm` | 0.875rem | Small text, captions |
| `--text-base` | 1rem | Body text |
| `--text-lg` | 1.125rem | Lead paragraphs |
| `--text-xl` | 1.25rem | h5, small headings |
| `--text-2xl` | 1.5rem | h4 |
| `--text-3xl` | 1.875rem | h3 |
| `--text-4xl` | 2.25rem | h2 |
| `--text-5xl` | 3rem | h1, hero |

**Line Heights:**
| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.25 | Headlines |
| `--leading-snug` | 1.375 | Compact text |
| `--leading-normal` | 1.6 | Body text |
| `--leading-relaxed` | 1.75 | Prose content |

### Colors

**Light Mode:**
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | #fafafa | Page background |
| `--bg-secondary` | #f5f5f5 | Alternate sections |
| `--bg-tertiary` | #ffffff | Cards, elevated surfaces |
| `--text-primary` | #1a1a1a | Main text |
| `--text-secondary` | #525252 | Secondary text |
| `--text-tertiary` | #737373 | Tertiary text |
| `--accent` | #2563eb | Links, CTAs |
| `--accent-hover` | #1d4ed8 | Hover state |
| `--border` | #e5e5e5 | Borders, dividers |

**Dark Mode:**
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | #171717 | Page background |
| `--bg-secondary` | #262626 | Alternate sections |
| `--bg-tertiary` | #1f1f1f | Cards, elevated surfaces |
| `--text-primary` | #fafafa | Main text |
| `--text-secondary` | #a3a3a3 | Secondary text |
| `--text-tertiary` | #9ca3af | Tertiary (WCAG adjusted) |
| `--accent` | #60a5fa | Links, CTAs |
| `--accent-hover` | #93c5fd | Hover state |
| `--border` | #404040 | Borders, dividers |

**Status Colors:**
| Status | Light | Dark |
|--------|-------|------|
| Active | #16a34a | #4ade80 |
| Completed | #2563eb | #60a5fa |

### Spacing

**Section Spacing:**
| Token | Value | Usage |
|-------|-------|-------|
| `--space-section-sm` | 3rem | Compact sections |
| `--space-section` | 4rem | Standard sections |
| `--space-section-lg` | 6rem | Hero, major sections |

**Container Widths:**
| Token | Value | Usage |
|-------|-------|-------|
| `--container-prose` | 680px | Blog posts, long-form |
| `--container-content` | 900px | Main content |
| `--container-wide` | 1100px | Full-width sections |

### Components

**UI Primitives:**
| Component | Variants | Props |
|-----------|----------|-------|
| `Button` | primary, secondary, ghost | size: sm, md, lg |
| `Card` | default, flat | - |
| `Tag` | - | - |

**Content Components:**
| Component | Purpose |
|-----------|---------|
| `ServiceCard` | Service tier display with features list |
| `ProjectCard` | Project showcase with status badge |
| `PostCard` | Blog post preview |
| `Testimonial` | Quote with author attribution |

**Layout Components:**
| Component | Features |
|-----------|----------|
| `Header` | Sticky nav, logo, mobile menu |
| `Footer` | Single-line layout: nav links left, social icons right (LinkedIn, Email) |
| `BaseLayout` | SEO, fonts, view transitions |

### Accessibility

**Requirements:**
- WCAG 2.1 AA compliance
- Minimum contrast ratio: 4.5:1 (normal text), 3:1 (large text)
- Focus indicators on all interactive elements
- `prefers-reduced-motion` respected
- Screen reader support (`sr-only` utility)
- Keyboard navigation support

**Implemented:**
- Dark mode tertiary text lightened (#9ca3af) for WCAG contrast
- Tag colors adjusted for sufficient contrast in both modes
- Focus-visible outlines on buttons, links, inputs
- Reduced motion media query disables animations

### Animations

| Animation | Duration | Trigger |
|-----------|----------|---------|
| Scroll reveal | 600ms | Intersection observer |
| Staggered children | 400ms + 100ms delay per child | Parent reveal |
| Link underline | 200ms | Hover |
| Button lift | 150ms | Hover |
| Card shadow | 200ms | Hover |
| View transitions | Native | Page navigation |

---

## Technical Architecture

### Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Astro** | 5.16.6 | Static site generation |
| **Tailwind CSS** | 4.1.18 | Utility-first styling |
| **TypeScript** | Latest (strict) | Type safety |
| **@astrojs/sitemap** | 3.6.0 | Auto-generated sitemap |

### Directory Structure

```
brandonkeao.github.io/
├── src/
│   ├── pages/              # Route pages
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── services.astro
│   │   ├── projects.astro
│   │   ├── contact.astro
│   │   ├── bookshelf.astro
│   │   ├── manager-readme.astro
│   │   └── writing/
│   │       ├── index.astro
│   │       └── [...slug].astro
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── ui/             # Primitives
│   │   │   ├── Button.astro
│   │   │   ├── Card.astro
│   │   │   └── Tag.astro
│   │   └── content/        # Content-specific
│   │       ├── ServiceCard.astro
│   │       ├── ProjectCard.astro
│   │       ├── PostCard.astro
│   │       └── Testimonial.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── content/
│   │   └── writing/        # 17 blog posts (Markdown)
│   ├── styles/
│   │   └── global.css      # Design tokens (~580 lines)
│   └── content.config.ts   # Content collection schema
├── public/
│   ├── CNAME               # Domain config
│   ├── favicon.svg
│   └── robots.txt
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions deployment
├── PROJECT.md              # This file
├── package.json
├── astro.config.mjs
└── tsconfig.json
```

### Deployment

**Platform:** GitHub Pages
**Domain:** brandonkeao.com (CNAME configured)
**Trigger:** Push to main branch or manual workflow_dispatch
**Build:** `npm run build` → outputs to `./dist`
**CI/CD:** GitHub Actions with Node 20, npm caching

### Content Schema

**Writing Posts (`content.config.ts`):**
```typescript
{
  title: string,        // Required
  description: string,  // Required
  date: Date,          // Required
  tags?: string[]      // Optional
}
```

### Key Features

- **Light Mode Only**: Clean editorial aesthetic, no theme toggle
- **View Transitions**: SPA-like navigation between pages
- **SEO**: Meta tags, Open Graph, Twitter Cards, sitemap, canonical URLs
- **Performance**: Static generation, font preloading, optimized images

---

## QA Standards

### Functionality Checklist

- [ ] All 8 pages load without errors
- [ ] Navigation links work (header and footer)
- [ ] Mobile menu opens/closes correctly
- [ ] Blog post listing displays all 17 posts
- [ ] Individual blog posts render correctly
- [ ] Contact form displays (currently placeholder)
- [ ] External links open in new tab
- [ ] View transitions work between pages

### Accessibility Checklist

- [ ] All pages pass WAVE accessibility tool
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast passes WCAG AA (4.5:1 text, 3:1 large)
- [ ] Images have alt text where appropriate
- [ ] Semantic HTML structure (headings hierarchy)
- [ ] Screen reader announces page changes
- [ ] Skip to content link present (if applicable)

### Performance Targets

| Metric | Target | Tool |
|--------|--------|------|
| Lighthouse Performance | 90+ | Chrome DevTools |
| Lighthouse Accessibility | 95+ | Chrome DevTools |
| Lighthouse Best Practices | 90+ | Chrome DevTools |
| Lighthouse SEO | 95+ | Chrome DevTools |
| First Contentful Paint | < 1.5s | Core Web Vitals |
| Largest Contentful Paint | < 2.5s | Core Web Vitals |
| Cumulative Layout Shift | < 0.1 | Core Web Vitals |

### SEO Checklist

- [ ] Meta title on all pages
- [ ] Meta description on all pages
- [ ] Open Graph tags present
- [ ] Twitter Card tags present
- [ ] Sitemap generated and accessible
- [ ] robots.txt configured
- [ ] Canonical URLs set
- [ ] Structured data (if applicable)

### Browser Support

| Browser | Versions | Status |
|---------|----------|--------|
| Chrome | Latest 2 | Required |
| Firefox | Latest 2 | Required |
| Safari | Latest 2 | Required |
| Edge | Latest 2 | Required |
| Mobile Safari | Latest 2 | Required |
| Mobile Chrome | Latest 2 | Required |

### Responsive Breakpoints

| Breakpoint | Width | Testing Required |
|------------|-------|------------------|
| Mobile | < 640px | Yes |
| Tablet | 640px - 1024px | Yes |
| Desktop | > 1024px | Yes |

---

## Changelog

### v1.1.2 - 2026-01-07

**Infrastructure**
- Configured GoDaddy DNS to point brandonkeao.com to GitHub Pages
- Custom domain verified and SSL certificate provisioned
- Site now live at https://brandonkeao.com

### v1.1.1 - 2026-01-07

**UX/UI Refinements**
- Fixed container CSS blocking Tailwind `py-*` utilities (`padding` → `padding-inline`)
- Updated header nav padding to `py-2` for tighter appearance
- Updated footer: `py-6` padding, link styling to match header (uppercase, tracking-widest)
- New favicon: sans-serif "B" in terracotta brand color (#c45c3d)

### v1.1.0 - 2026-01-03

**Editorial Design System Overhaul**
- Removed dark mode entirely (deleted ThemeToggle component)
- Updated typography: DM Serif Display headlines, Source Serif 4 prose, Inter UI
- Changed accent color to terracotta (#c45c3d)
- Simplified footer to single-line layout (nav links left, social icons right)
- Removed X/Twitter from social links
- Applied editorial styling across pages (eyebrow text, sharp corners, generous spacing)

### v1.0.0 - 2026-01-03

**Initial Release**
- PROJECT.md created for centralized documentation
- All content implemented from FINAL_CONTENT_PACKAGE
- Navigation structure finalized
- Design system documented

### Pre-1.0 History

| Commit | Description | Date |
|--------|-------------|------|
| `7429f9e` | Fix accessibility and design token consistency | Jan 3, 2026 |
| `a36c701` | Fix navigation to include Bookshelf and Manager README | Jan 3, 2026 |
| `2a8c7b4` | Update website content with approved copy | Jan 3, 2026 |
| `a662f2f` | Website redesign with new components and enhanced styling | Dec 31, 2025 |
| `3294eb8` | Initial website build with Astro + Tailwind | Dec 2025 |

---

## Maintenance Notes

### Updating This Document

When making changes to the project:
1. Update the relevant section in this document
2. Add entry to Changelog with date
3. Increment version if significant change
4. Update `last_updated` in frontmatter

### Version Numbering

- **Major (x.0.0)**: Significant redesign or architecture change
- **Minor (0.x.0)**: New pages, features, or components
- **Patch (0.0.x)**: Bug fixes, content updates, minor adjustments

---

*Last updated: 2026-01-07*
