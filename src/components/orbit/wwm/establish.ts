import type { EngagementSlug } from '../../../lib/orbit/orbit-data';
import type { FormationHandle } from '../../../lib/orbit/formation-scene';

/**
 * The selected-state establishing shot (ticket #13, Brandon's Oct 11 direction): choosing a
 * model lands you in a zoomed-out view of that concept, not a zoomed-in corner of the wide
 * orbit. This controller owns the one live establish-view Formation scene on the stage's
 * `[data-establish-host]` layer and the `data-establish` attribute that fades the orbital
 * scene beneath it.
 *
 * Desktop only (phones keep the orbital stage — the story media right below carries the
 * concept there), never under reduced motion, never without WebGL. At most one instance
 * lives at a time: a model switch disposes before creating; a restore lets the crossfade
 * finish before disposing; teardown disposes immediately.
 */

export interface EstablishController {
  set(slug: EngagementSlug | null): void;
  dispose(): void;
}

export function createEstablish(stage: HTMLElement | null): EstablishController {
  const host = stage?.querySelector<HTMLElement>('[data-establish-host]') ?? null;
  const mq = matchMedia('(min-width: 861px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let want: EngagementSlug | null = null;
  let live: { slug: EngagementSlug; scene: FormationHandle } | null = null;
  let creating = 0; // token: a stale async create must not land
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let webgl: boolean | undefined; // probed lazily, once

  const probeWebgl = () => {
    if (webgl !== undefined) return webgl;
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return webgl;
  };

  const drop = (immediate: boolean) => {
    const dying = live;
    live = null;
    host?.removeAttribute('data-on');
    host?.classList.remove('is-live');
    if (!dying) return;
    if (immediate) {
      dying.scene.dispose();
      return;
    }
    // Let the layer fade out before the canvas goes away; transitionend is the signal,
    // the timeout the guarantee.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      host?.removeEventListener('transitionend', finish);
      dying.scene.dispose();
    };
    host?.addEventListener('transitionend', finish);
    fadeTimer = setTimeout(finish, 1200);
  };

  const fail = () => {
    // A dead canvas or failed import must never leave a black hole over the stage: the
    // orbital scene stands back up.
    stage?.removeAttribute('data-establish');
    drop(true);
  };

  const sync = () => {
    if (disposed) return;
    const eligible = !!want && !!stage && !!host && mq.matches && !reduced.matches && probeWebgl();
    if (!eligible) {
      stage?.removeAttribute('data-establish');
      drop(false);
      return;
    }
    stage!.setAttribute('data-establish', '');
    if (live?.slug === want) {
      host!.setAttribute('data-on', '');
      return;
    }
    // A switch replaces the one instance; the layer's opaque ground covers the gap.
    drop(true);
    host!.setAttribute('data-on', '');
    const token = ++creating;
    const slug = want!;
    import('../../../lib/orbit/formation-scene')
      .then(({ createFormation }) => {
        if (disposed || token !== creating || want !== slug) return;
        const scene = createFormation(host!, slug, { view: 'establish' });
        live = { slug, scene };
        host!.classList.add('is-live');
        syncPause();
        host!.querySelector('canvas')?.addEventListener('webglcontextlost', fail, { once: true });
      })
      .catch(fail);
  };

  // The stage's own Pause control should also hold the establishing shot.
  const pauseBtn = stage?.querySelector<HTMLElement>('[data-pause]') ?? null;
  const syncPause = () => live?.scene.pause(pauseBtn?.getAttribute('aria-pressed') === 'true');
  const pauseWatch = pauseBtn ? new MutationObserver(syncPause) : null;
  if (pauseBtn && pauseWatch) pauseWatch.observe(pauseBtn, { attributes: true, attributeFilter: ['aria-pressed'] });

  mq.addEventListener('change', sync);

  return {
    set(slug) {
      want = slug;
      sync();
    },
    dispose() {
      disposed = true;
      clearTimeout(fadeTimer);
      mq.removeEventListener('change', sync);
      pauseWatch?.disconnect();
      stage?.removeAttribute('data-establish');
      const dying = live;
      live = null;
      host?.removeAttribute('data-on');
      host?.classList.remove('is-live');
      dying?.scene.dispose();
    },
  };
}
