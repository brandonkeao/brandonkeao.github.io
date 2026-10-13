// Work with me (ticket #8, Direction B; ticket #34, designer review Phase 1): overview ⇄ selected
// state for /services/.
//
// One selection mechanism: the three selector cards at the top of the white sheet (layout O1,
// Brandon 2026-10-13). They are toggle buttons with a pressed state, nothing pressed on load,
// and they stay in place as the switcher after a choice — they replace the overview rows, the
// hero's chip dock and the phone tabs. Selection lives in ?engagement=full-time|fractional|
// advisory (pushState; Back/Forward restore it; a deep link selects on load).
//
// No way back to the Overview on the page (Brandon, 2026-10-12 round 14): visitors switch
// directly between models; the Overview is the pre-selection state only. Browser Back keeps
// its history entries (D1): it steps through prior models and finally cuts to the Overview,
// softened by the one-shot sections fade.
//
// Progressive enhancement: everything is server-rendered and visible. Without JavaScript the
// cards are plain links to ?engagement=…#wwm-… and all three details read stacked. This script
// hides what the current state does not show, by toggling `hidden`.
//
// The orbital stage left the hero (designer review, Oct 13): there is no stage coupling here any
// more — no chip following, no flight-timed swap. The scene now sits in its own band at the end
// of the page (SceneBand.astro) and does not take part in selection.
import { SETS, type EngagementSlug } from '../../../lib/orbit/orbit-data';

type Slug = EngagementSlug;
type Origin = 'init' | 'cards' | 'history';

const SLUGS = SETS.work.map((w) => w.slug!) as Slug[];
const parse = (v: string | null): Slug | null => (v && (SLUGS as string[]).includes(v) ? (v as Slug) : null);

export function initWorkWithMe(): (() => void) | undefined {
  const found = document.querySelector<HTMLElement>('[data-wwm]');
  if (!found) return undefined;
  const root: HTMLElement = found;

  const ctl = new AbortController();
  const opts = { signal: ctl.signal };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
  const pathname = location.pathname;

  const flow = root.querySelector<HTMLElement>('[data-wwm-flow]')!;
  const selector = root.querySelector<HTMLElement>('[data-wwm-select]')!;
  const cards = [...root.querySelectorAll<HTMLAnchorElement>('[data-wwm-choose]')];
  const details = [...root.querySelectorAll<HTMLElement>('[data-wwm-detail]')];
  const closings = [...root.querySelectorAll<HTMLElement>('[data-wwm-closing]')];
  const overviewOnly = [...root.querySelectorAll<HTMLElement>('[data-wwm-overview]')];

  // The cards become toggle buttons (the first-paint script in services.astro already did this
  // before paint; repeated here so a page swap that skipped it still works).
  cards.forEach((c) => {
    c.setAttribute('role', 'button');
    if (!c.hasAttribute('aria-pressed')) c.setAttribute('aria-pressed', 'false');
  });

  let current: Slug | null = null;
  let baseIndex: number | undefined = history.state?.index;

  /* ---- state ---------------------------------------------------------------------------- */
  let returning: ReturnType<typeof setTimeout> | undefined;
  // A card choice moves focus to the model's title once that title is showing.
  let focusAfter: Slug | null = null;

  /** The DOM half of a state change: what shows and what hides. The cards never move. */
  function show(slug: Slug | null) {
    root.dataset.state = slug ? 'selected' : 'overview';
    details.forEach((d) => { d.hidden = d.dataset.wwmDetail !== slug; });
    closings.forEach((c) => { c.hidden = c.dataset.wwmClosing !== slug; });
    overviewOnly.forEach((el) => { el.hidden = !!slug; });
    cards.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.wwmChoose === slug)));
    // Focus follows a choice to the model's title. Any other path that hides the focused
    // element (history) lands there too, so focus is never left on a hidden element; a deep
    // link or Back with focus elsewhere keeps it.
    const active = document.activeElement;
    const lost = !!active && active !== document.body && !!active.closest('[hidden]');
    if (slug && (focusAfter === slug || lost)) document.getElementById(`wwm-${slug}-title`)?.focus({ preventScroll: true });
    focusAfter = null;
  }

  function apply(slug: Slug | null, origin: Origin) {
    // Browser Back to the Overview fades its sections back in (round 12: the pop was jarring);
    // the one-shot class keeps the first paint and deep links animation-free.
    if (!slug && current && origin !== 'init') {
      root.classList.add('wwm-returning');
      clearTimeout(returning);
      returning = setTimeout(() => root.classList.remove('wwm-returning'), 450);
    }
    current = slug;
    show(slug);

    if (origin === 'cards') {
      const url = new URL(location.href);
      if (slug) url.searchParams.set('engagement', slug);
      else url.searchParams.delete('engagement');
      url.hash = '';
      if (url.href !== location.href) {
        // Keep the router's entry shape (index, scroll) so Astro's history stays coherent.
        if (history.state) history.replaceState({ ...history.state, scrollX, scrollY }, '');
        baseIndex ??= history.state?.index;
        history.pushState({ ...(history.state ?? {}), scrollX, scrollY, wwm: slug }, '', url);
      }
    }
  }

  // Keep the visitor where they are: only when the cards have scrolled above the window
  // (a keyboard choice made from further down) bring them back to the top.
  function settleScroll() {
    const top = selector.getBoundingClientRect().top;
    if (top < 0) scrollTo({ top: scrollY + top - 16, behavior });
  }

  function choose(slug: Slug) {
    if (slug === current) return;
    focusAfter = slug;
    apply(slug, 'cards');
    settleScroll();
  }

  /* ---- events --------------------------------------------------------------------------- */
  const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  cards.forEach((c) => {
    c.addEventListener('click', (e) => {
      if (!plainClick(e)) return;
      e.preventDefault();
      choose(c.dataset.wwmChoose as Slug);
    }, opts);
    // A link answers Enter; as a toggle button it answers Space too.
    c.addEventListener('keydown', (e) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      choose(c.dataset.wwmChoose as Slug);
    }, opts);
  });

  // Back/Forward between this page's own entries: handle in place, before Astro's router
  // would re-render the page. Other entries go to Astro. Astro registers its popstate
  // listener first, so the early hook in SiteHead calls this; the capture listener is only a
  // fallback should that hook be missing (each stops the other once handled).
  const onPop = (e: PopStateEvent): boolean => {
    if (location.pathname !== pathname) return false;
    const st = e.state as { index?: number; scrollX?: number; scrollY?: number } | null;
    if (st && typeof st.index === 'number' && baseIndex !== undefined && st.index !== baseIndex) return false;
    apply(parse(new URLSearchParams(location.search).get('engagement')), 'history');
    if (st && typeof st.scrollY === 'number') scrollTo(st.scrollX ?? 0, st.scrollY);
    return true;
  };
  const w = window as Window & { __samePagePop?: (e: PopStateEvent) => boolean };
  w.__samePagePop = onPop;
  addEventListener('popstate', (e) => { if (onPop(e)) e.stopImmediatePropagation(); }, { signal: ctl.signal, capture: true });

  /* ---- first paint ---------------------------------------------------------------------- */
  const initial = parse(new URLSearchParams(location.search).get('engagement'));
  apply(initial, 'init');
  // A deep link opens on the selected model, unless the router already restored a position.
  // The cards and the model's intro already show on a desktop's first screen, so only an
  // explicit #hash scrolls; on phones the cards and the start of the detail show.
  if (initial && scrollY === 0) {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
    else if (matchMedia('(max-width: 860px)').matches) flow.scrollIntoView({ block: 'start' });
  }

  return () => {
    if (w.__samePagePop === onPop) delete w.__samePagePop;
    ctl.abort();
    clearTimeout(returning);
  };
}
