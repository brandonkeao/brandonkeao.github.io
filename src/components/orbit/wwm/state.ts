// Work with me (ticket #8, Direction B): overview ⇄ selected state for /services/.
//
// One selection mechanism, three ways in: the overview rows, the sticky switcher's tabs, and the
// orbit's chips. Selection lives in ?engagement=full-time|fractional|advisory (pushState;
// Back/Forward restore it; a deep link selects on load).
//
// Progressive enhancement: everything is server-rendered and visible. Without JavaScript the rows
// are plain links to ?engagement=…#wwm-… and all three details read stacked. This script hides
// what the current state does not show, by toggling `hidden`.
//
// The orbit (OrbitStage, read-only here) is kept in step without touching its code: the page
// "presses" its chips or its Back button, and watches the chips' aria-pressed and the stage's
// data-mode to follow selections the visitor makes on the orbit itself.
import { SETS, type CategoryId, type EngagementSlug } from '../../../lib/orbit/orbit-data';

type Slug = EngagementSlug;
type Origin = 'init' | 'rows' | 'tabs' | 'stage' | 'restore' | 'history';

const SLUGS = SETS.work.map((w) => w.slug!) as Slug[];
const slugOf = (id: string | undefined): Slug | null => SETS.work.find((w) => w.id === id)?.slug ?? null;
const idOf = (slug: Slug): CategoryId => SETS.work.find((w) => w.slug === slug)!.id;
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
  const switcher = root.querySelector<HTMLElement>('[data-wwm-switcher]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-wwm-tab]')];
  const rows = [...root.querySelectorAll<HTMLAnchorElement>('[data-wwm-choose]')];
  const details = [...root.querySelectorAll<HTMLElement>('[data-wwm-detail]')];
  const overviewOnly = [...root.querySelectorAll<HTMLElement>('[data-wwm-overview]')];

  const hero = document.querySelector<HTMLElement>('.orbit-hero');
  const stage = hero?.querySelector<HTMLElement>('.map-stage[data-orbit="work"]') ?? null;
  const chips = hero ? [...hero.querySelectorAll<HTMLButtonElement>('.engagement-chip[data-id]')] : [];
  const stageBack = hero?.querySelector<HTMLButtonElement>('[data-back]') ?? null;
  const surfaces = [...root.querySelectorAll<HTMLElement>('[data-wwm-surface]')];

  let current: Slug | null = null;
  // Where the page last asked the orbit to be; undefined once it is there.
  let desired: Slug | null | undefined;
  let baseIndex: number | undefined = history.state?.index;

  /* ---- the orbit ------------------------------------------------------------------------ */
  const pressedChip = (): Slug | null => slugOf(chips.find((c) => c.getAttribute('aria-pressed') === 'true')?.dataset.id);
  let lastSeen = pressedChip();

  function command(slug: Slug | null) {
    if (slug === null) { if (stageBack && !stageBack.hidden) stageBack.click(); return; }
    chips.find((c) => c.dataset.id === idOf(slug))?.click();
  }

  // Runs on every orbit attribute change (batched) and after each page selection.
  function onStage() {
    if (!stage) return;
    const ready = stage.classList.contains('is-ready');
    const mode = stage.dataset.mode;
    if (!ready) {
      // No renderer yet (or no WebGL): chips still mark a choice; follow it, never command it.
      const pressed = pressedChip();
      if (pressed !== lastSeen) { lastSeen = pressed; if (pressed && pressed !== current) apply(pressed, 'stage'); }
      return;
    }
    if (mode === 'leaving') return;
    const pressed = mode === 'overview' ? null : pressedChip();
    if (desired !== undefined) {
      if (pressed === desired) { desired = undefined; lastSeen = pressed; return; }
      if (mode !== 'entering') command(desired);
      return;
    }
    if (pressed === lastSeen) return;
    lastSeen = pressed;
    if (pressed !== current) apply(pressed, 'stage');
  }

  const watch = new MutationObserver(onStage);
  if (hero) watch.observe(hero, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'class', 'data-mode'] });

  /* ---- state ---------------------------------------------------------------------------- */
  function apply(slug: Slug | null, origin: Origin) {
    current = slug;
    root.dataset.state = slug ? 'selected' : 'overview';
    selector.hidden = !!slug;
    switcher.hidden = !slug;
    details.forEach((d) => { d.hidden = d.dataset.wwmDetail !== slug; });
    overviewOnly.forEach((el) => { el.hidden = !!slug; });
    // Land on the chosen model's surface (ticket #10); ascend back to orbit on restore.
    // data-landed fades the orbit scene beneath, so the plate's masked edges melt into the
    // stage's own ground instead of framing a box over the running scene.
    surfaces.forEach((el) => el.toggleAttribute('data-on', el.dataset.wwmSurface === slug));
    stage?.toggleAttribute('data-landed', !!slug);
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.wwmTab === slug)));
    // Phones: the tab row scrolls sideways; keep the pressed tab in view (horizontal only).
    const on = tabs.find((t) => t.dataset.wwmTab === slug);
    const row = on?.parentElement;
    if (on && row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - 8);

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
    apply(slug, origin);
    settleScroll();
    if (origin === 'rows') document.getElementById(`wwm-${slug}-title`)?.focus({ preventScroll: true });
  }

  function restore() {
    const prev = current;
    if (!prev) return;
    apply(null, 'restore');
    settleScroll();
    rows.find((r) => r.dataset.wwmChoose === prev)?.focus({ preventScroll: true });
  }

  /* ---- events --------------------------------------------------------------------------- */
  const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  rows.forEach((r) => r.addEventListener('click', (e) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    choose(r.dataset.wwmChoose as Slug, 'rows');
  }, opts));
  tabs.forEach((t) => t.addEventListener('click', () => choose(t.dataset.wwmTab as Slug, 'tabs'), opts));
  root.querySelector<HTMLAnchorElement>('[data-wwm-restore]')?.addEventListener('click', (e) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    restore();
  }, opts);

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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !current || e.defaultPrevented) return;
    if (document.querySelector('[data-menu-toggle][aria-expanded="true"]')) return;
    restore();
  }, opts);

  // Back/Forward between this page's own entries: handle in place, before Astro's router
  // (capture runs first at the window) would re-render the page. Other entries go to Astro.
  addEventListener('popstate', (e) => {
    if (location.pathname !== pathname) return;
    const st = e.state as { index?: number; scrollX?: number; scrollY?: number } | null;
    if (st && typeof st.index === 'number' && baseIndex !== undefined && st.index !== baseIndex) return;
    e.stopImmediatePropagation();
    apply(parse(new URLSearchParams(location.search).get('engagement')), 'history');
    if (st && typeof st.scrollY === 'number') scrollTo(st.scrollX ?? 0, st.scrollY);
  }, { signal: ctl.signal, capture: true });

  /* ---- first paint ---------------------------------------------------------------------- */
  const initial = parse(new URLSearchParams(location.search).get('engagement'));
  apply(initial, 'init');
  // A deep link opens on the selected model, unless the router already restored a position.
  if (initial && scrollY === 0) {
    const target = (location.hash && document.getElementById(location.hash.slice(1))) || flow;
    target.scrollIntoView({ block: 'start' });
  }

  return () => {
    ctl.abort();
    watch.disconnect();
  };
}
