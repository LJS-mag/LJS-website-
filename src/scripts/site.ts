import { state, reduceMotion } from './state';
import { labelTimes } from './ago';

const reduce = reduceMotion();
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

/* ---- mobile menu ---- */
const burger = $('#burger');
const menu = $('#menu');
burger?.addEventListener('click', () => {
  const open = menu!.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});
menu?.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) {
    menu.classList.remove('open');
    burger?.setAttribute('aria-expanded', 'false');
  }
});

/* ---- reveal on scroll (only hides things when JS runs: see .js .rv in global.css) ---- */
const REVEAL =
  '.sec-head,.ig-head,.ig-grid>*,.intro .wrap>*,.feature>*,.grid>*,.team-grid>*,.tg>.gh,.tg>.gi,.values>*,.stats>*,.cta .wrap>*,.form-wrap>*,.rev>*,.ritem,.chips';
const stagger = new Map<Element, number>();
$$(REVEAL).forEach((el) => {
  const i = stagger.get(el.parentElement!) ?? 0;
  stagger.set(el.parentElement!, i + 1);
  el.classList.add('rv');
  el.style.setProperty('--d', `${Math.min(i, 7) * 0.08}s`);
});
if (reduce || !('IntersectionObserver' in window)) {
  $$('.rv').forEach((e) => e.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.1, rootMargin: '0px 0px -4% 0px' },
  );
  $$('.rv').forEach((e) => io.observe(e));

  /* count-up numbers */
  const counters = $$('[data-to]');
  if (counters.length) {
    counters.forEach((e) => (e.textContent = '0' + (e.dataset.suf || '')));
    const cio = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (!en.isIntersecting) return;
          cio.unobserve(en.target);
          const el = en.target as HTMLElement;
          const to = Number(el.dataset.to);
          const suf = el.dataset.suf || '';
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / 1300);
            el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { threshold: 0.6 },
    );
    counters.forEach((e) => cio.observe(e));
  }
}

/* ---- scroll progress bar, hero choreography, parallax ---- */
const prog = $('#prog');
const hero = $('#hero');
const track = $('#heroTrack');
if (track && reduce) track.classList.add('static');
let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    prog?.style.setProperty('--p', String(max > 0 ? Math.min(1, y / max) : 0));
    if (reduce) return;
    if (hero && track) {
      const r = track.getBoundingClientRect();
      const span = track.offsetHeight - hero.offsetHeight;
      const p = span > 0 ? Math.max(0, Math.min(1, (68 - r.top) / span)) : 0;
      state.hp = p;
      hero.style.setProperty('--hp', p.toFixed(4));
      hero.classList.toggle('q-on', p > 0.45);
      hero.classList.toggle('f-off', p > 0.2);
    }
    $$('[data-par]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const c = r.top + r.height / 2 - innerHeight / 2;
      el.style.transform = `translateY(${(-c * parseFloat(el.dataset.par || '0')).toFixed(1)}px)`;
    });
  });
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ---- "a month ago" labels ---- */
labelTimes();

/* ---- live Instagram feed (only when the society has connected one in Settings) ---- */
if ($('.ig-grid[data-feed]')) import('./instagram').catch(() => {});

/* ---- 3D tilt on covers ---- */
if (!reduce) {
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const t = (e.target as Element).closest?.('[data-tilt]') as HTMLElement | null;
    if (!t) return;
    t.classList.add('tilt');
    const r = t.getBoundingClientRect();
    t.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2) + 'deg');
    t.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 10).toFixed(2) + 'deg');
  });
  document.addEventListener('pointerout', (e) => {
    const t = (e.target as Element).closest?.('[data-tilt]') as HTMLElement | null;
    if (t && !t.contains(e.relatedTarget as Node)) {
      t.style.setProperty('--rx', '0deg');
      t.style.setProperty('--ry', '0deg');
    }
  });
}

/* ---- chip filters (journal categories, team groups). Works without changing the URL. ---- */
$$('[data-filter]').forEach((bar) => {
  const attr = `data-${bar.dataset.filter}`;
  bar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!b) return;
    $$('.chip', bar).forEach((c) => {
      c.classList.toggle('on', c === b);
      c.setAttribute('aria-pressed', String(c === b));
    });
    const v = b.dataset.c;
    $$(`[${attr}]`).forEach((it) => {
      it.hidden = !(v === 'All' || it.getAttribute(attr) === v);
    });
  });
});

/* ---- hero: video after the page has loaded, 3D pages on larger screens ---- */
const idle = (f: () => void) => {
  const go = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 2500 }) : f()), innerWidth < 700 ? 1200 : 0);
  document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
};
const hv = $<HTMLVideoElement>('#hv');
const saveData = (navigator as any).connection?.saveData;
if (hv && !reduce && !saveData) {
  idle(() => {
    hv.muted = true;
    hv.preload = 'auto';
    hv.play().catch(() => {});
  });
}
if ($('#gl') && !reduce && innerWidth >= 700) {
  idle(() => import('./hero3d').then((m) => m.initHero3d()).catch(() => {}));
}

/* ---- forms (only loaded on pages that have one) ---- */
if ($('[data-form]')) import('./forms');
