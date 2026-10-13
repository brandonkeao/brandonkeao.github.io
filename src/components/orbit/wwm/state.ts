// Work with me (ticket #8, Direction B): overview ⇄ selected state for /services/.
//
// One selection mechanism, three ways in: the overview rows, the sticky switcher's tabs, and the
// orbit's chips. Selection lives in ?engagement=full-time|fractional|advisory (pushState;
// Back/Forward restore it; a deep link selects on load).
//
// No way back to the Overview on the page (Brandon, 2026-10-12 round 14): visitors switch
// directly between models; the Overview is the pre-selection state only. Browser Back keeps
// its history entries (D1): it steps through prior models and finally cuts to the Overview
// with an instant stage reset (no flight), softened by the one-shot sections fade.
//
// Progressive enhancement: everything is server-rendered and visible. Without JavaScript the rows
// are plain links to ?engagement=…#wwm-… and all three details read stacked. This script hides
// what the current state does not show, by toggling `hidden`.
//
// The orbit (OrbitStage) is kept in step from outside: the page "presses" its chips, asks the
// stage for an instant reset with an `orbit:reset` event, and watches the chips' aria-pressed
// and the stage's data-mode to follow selections the visitor makes on the orbit itself.
import { SETS, type CategoryId, type EngagementSlug } from '../../../lib/orbit/orbit-data';
import { MISSION_FADE, flightTimeAt } from '../../../lib/orbit/orbits';

type Slug = EngagementSlug;
type Origin = 'init' | 'rows' | 'tabs' | 'stage' | 'history';

const SLUGS = SETS.work.map((w) => w.slug!) as Slug[];
const slugOf = (id: string | undefined): Slug | null => SETS.work.find((w) => w.id === id)?.slug ?? null;
const idOf = (slug: Slug): CategoryId => SETS.work.find((w) => w.slug === slug)!.id;
const parse = (v: string | null): Slug | null => (v && (SLUGS as string[]).includes(v) ? (v as Slug) : null);

// The Overview → model gesture runs on the flight's clock (2026-10-13 enter-transition rework):
// the rows and the Overview bands fade out while the system starts to recede (the first tenth
// of the eased blend), the page swaps there — before the camera has really moved — and the
// model's intro fades in exactly while its mission does (MISSION_FADE), so copy and orbit read
// as one motion. Without a visible, ready stage the swap stays immediate.
const OUT_MS = Math.round(flightTimeAt(0.1));
const IN_FROM_MS = Math.round(flightTimeAt(MISSION_FADE[0]));
const IN_TO_MS = Math.round(flightTimeAt(MISSION_FADE[1]));

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
  const switcher = root.querySelector<HTMLElement>('[data-wwm-switcher]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-wwm-tab]')];
  const rows = [...root.querySelectorAll<HTMLAnchorElement>('[data-wwm-choose]')];
  const details = [...root.querySelectorAll<HTMLElement>('[data-wwm-detail]')];
  const overviewOnly = [...root.querySelectorAll<HTMLElement>('[data-wwm-overview]')];

  const hero = document.querySelector<HTMLElement>('.orbit-hero');
  const stage = hero?.querySelector<HTMLElement>('.map-stage[data-orbit="work"]') ?? null;
  const chips = hero ? [...hero.querySelectorAll<HTMLButtonElement>('.engagement-chip[data-id]')] : [];
  // The selected state is the orbital stage's own flight to the chosen moon (Brandon,
  // 2026-10-12): the moon centres and grows with its mission flying around it. The round-3
  // crossfade establish layer is retired; desktop and phones now behave the same.

  let current: Slug | null = null;
  // Where the page last asked the orbit to be; undefined once it is there.
  let desired: Slug | null | undefined;
  let baseIndex: number | undefined = history.state?.index;

  /* ---- the orbit ------------------------------------------------------------------------ */
  const pressedChip = (): Slug | null => slugOf(chips.find((c) => c.getAttribute('aria-pressed') === 'true')?.dataset.id);
  let lastSeen = pressedChip();

  function command(slug: Slug | null) {
    // Back to the bare URL: the stage cuts to the Overview at once (D1; no leave flight).
    // This must resolve, or `desired` stays null and the page stops following the chips.
    if (slug === null) { stage?.dispatchEvent(new CustomEvent('orbit:reset')); return; }
    chips.find((c) => c.dataset.id === idOf(slug))?.click();
  }

  // Runs on every orbit attribute change (batched) and after each page selection.
  function onStage() {
    if (!stage) return;
    const ready = stage.classList.contains('is-ready');
    const mode = stage.dataset.mode;
    if (!ready) {
      // No renderer yet (or no WebGL): pressing a chip only marks the choice, and the stage
      // settles on a marked choice instantly when its renderer arrives — so a deep link or a
      // Back/Forward made before then lands on the moon with no flight (round 9). Otherwise
      // follow the chips.
      const pressed = pressedChip();
      if (desired !== undefined) {
        if (pressed === desired) { desired = undefined; lastSeen = pressed; } else command(desired);
        return;
      }
      if (pressed !== lastSeen) { lastSeen = pressed; if (pressed && pressed !== current) apply(pressed, 'stage'); }
      return;
    }
    if (mode === 'leaving') return;
    const pressed = mode === 'overview' ? null : pressedChip();
    if (desired !== undefined) {
      if (pressed === desired) { desired = undefined; lastSeen = pressed; return; }
      // A model waits for a running flight to land; the Overview cuts at once.
      if (mode !== 'entering' || desired === null) command(desired);
      return;
    }
    if (pressed === lastSeen) return;
    lastSeen = pressed;
    if (pressed !== current) apply(pressed, 'stage');
  }

  const watch = new MutationObserver(onStage);
  if (hero) watch.observe(hero, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'class', 'data-mode'] });

  /* ---- state ---------------------------------------------------------------------------- */
  let returning: ReturnType<typeof setTimeout> | undefined;
  let swapping: ReturnType<typeof setTimeout> | undefined;
  let arriving: ReturnType<typeof setTimeout> | undefined;
  // A row choice moves focus to the model's title once that title is showing.
  let focusAfter: Slug | null = null;
  root.style.setProperty('--wwm-out', `${OUT_MS}ms`);
  root.style.setProperty('--wwm-in-delay', `${IN_FROM_MS - OUT_MS}ms`);
  root.style.setProperty('--wwm-in-dur', `${IN_TO_MS - IN_FROM_MS}ms`);

  /** Is the orbit on screen and live, so the visitor watches the flight? */
  function watching(): boolean {
    if (!stage || reduced || !stage.classList.contains('is-ready')) return false;
    const r = stage.getBoundingClientRect();
    const seen = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return seen > r.height * 0.3;
  }

  /** The DOM half of a state change: what shows and what hides. */
  function show(slug: Slug | null) {
    root.classList.remove('wwm-leaving');
    root.dataset.state = slug ? 'selected' : 'overview';
    selector.hidden = !!slug;
    switcher.hidden = !slug;
    details.forEach((d) => { d.hidden = d.dataset.wwmDetail !== slug; });
    overviewOnly.forEach((el) => { el.hidden = !!slug; });
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.wwmTab === slug)));
    // Phones: the tab row scrolls sideways; keep the pressed tab in view (horizontal only).
    const on = tabs.find((t) => t.dataset.wwmTab === slug);
    const row = on?.parentElement;
    if (on && row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - 8);
    if (slug && focusAfter === slug) document.getElementById(`wwm-${slug}-title`)?.focus({ preventScroll: true });
    focusAfter = null;
  }

  function apply(slug: Slug | null, origin: Origin) {
    // Browser Back to the Overview fades its sections back in (round 12: the pop was jarring;
    // kept by D1 as the softener of the stage's cut); the one-shot class keeps the first paint
    // and deep links animation-free.
    if (!slug && current && origin !== 'init') {
      root.classList.add('wwm-returning');
      clearTimeout(returning);
      returning = setTimeout(() => root.classList.remove('wwm-returning'), 450);
    }
    const from = current;
    current = slug;
    clearTimeout(swapping);
    // Overview → model with the flight in view: fade the Overview out, swap on the flight's
    // clock (see OUT_MS), and let the model's intro arrive with its mission.
    if (slug && !from && origin !== 'init' && watching()) {
      root.classList.add('wwm-leaving');
      swapping = setTimeout(() => {
        root.classList.add('wwm-arriving');
        show(slug);
        clearTimeout(arriving);
        arriving = setTimeout(() => root.classList.remove('wwm-arriving'), IN_TO_MS - OUT_MS + 100);
      }, OUT_MS);
    } else {
      root.classList.remove('wwm-arriving');
      show(slug);
    }

    if (origin !== 'init' && origin !== 'history') {
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

    if (origin === 'stage') desired = undefined;
    else { desired = slug; onStage(); }
  }

  // Keep the visitor where they are: only when the flow's top has scrolled past the viewport
  // (switcher stuck, or the rows collapsed above them) bring the switcher back to the top.
  function settleScroll() {
    const top = flow.getBoundingClientRect().top;
    if (top < 0) scrollTo({ top: scrollY + top, behavior });
  }

  function choose(slug: Slug, origin: 'rows' | 'tabs') {
    if (slug === current) return;
    if (origin === 'rows') focusAfter = slug;
    apply(slug, origin);
    settleScroll();
  }

  /* ---- events --------------------------------------------------------------------------- */
  const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  rows.forEach((r) => r.addEventListener('click', (e) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    choose(r.dataset.wwmChoose as Slug, 'rows');
  }, opts));
  tabs.forEach((t) => t.addEventListener('click', () => choose(t.dataset.wwmTab as Slug, 'tabs'), opts));

  // The orbit's step chips link into this page's selected state; handle them in place.
  hero?.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('[data-steps] a[href]');
    if (!a || !plainClick(e)) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== pathname) return;
    const slug = parse(url.searchParams.get('engagement'));
    if (!slug) return;
    e.preventDefault();
    if (slug !== current) apply(slug, 'rows');
    document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior, block: 'start' });
  }, opts);

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

  /* ---- layout coupling ------------------------------------------------------------------ */
  // The story's sticky media stacks under the sticky switcher on phones; publish the
  // switcher's real height (it wraps to several rows at narrow widths) as a CSS variable
  // so the media and hash-jump offsets track it instead of guessing.
  const switcherSize = new ResizeObserver(() => {
    const h = switcher.offsetHeight;
    if (h) root.style.setProperty('--wwm-switcher-h', `${h}px`);
  });
  switcherSize.observe(switcher);

  // Desktop's sticky model band (round 13): the story's sticky media and hash jumps sit
  // below it, so publish the visible band's real height the same way.
  const intros = [...root.querySelectorAll<HTMLElement>('[data-wwm-intro]')];
  const introSize = new ResizeObserver(() => {
    const on = intros.find((el) => el.offsetParent !== null);
    if (on?.offsetHeight) root.style.setProperty('--wwm-intro-h', `${on.offsetHeight}px`);
  });
  intros.forEach((el) => introSize.observe(el));

  /* ---- first paint ---------------------------------------------------------------------- */
  const initial = parse(new URLSearchParams(location.search).get('engagement'));
  apply(initial, 'init');
  // A deep link opens on the selected model, unless the router already restored a position.
  // Desktop's first screen already holds the moon and the model's intro (round 10), so only
  // phones scroll down to the content; an explicit #hash still wins everywhere.
  if (initial && scrollY === 0) {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
    else if (matchMedia('(max-width: 860px)').matches) flow.scrollIntoView({ block: 'start' });
  }

  return () => {
    if (w.__samePagePop === onPop) delete w.__samePagePop;
    ctl.abort();
    watch.disconnect();
    switcherSize.disconnect();
    introSize.disconnect();
    clearTimeout(returning);
    clearTimeout(swapping);
    clearTimeout(arriving);
  };
}
