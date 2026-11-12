import { labelTimes } from './ago';

/* Live Instagram grid. When the society connects a Behold feed link in Settings, the newest posts are read here,
   in the visitor's browser, and replace the hand-added tiles. If the feed is paused, blocked or offline, the hand-added
   tiles that the page already shows stay exactly as they are, so the section never goes blank.
   The feed is cached on the device for 6 hours so repeat visits do not use up the free plan's monthly views. */

type Sizes = { medium?: { mediaUrl?: string }; large?: { mediaUrl?: string }; small?: { mediaUrl?: string } };
type BPost = {
  id?: string; timestamp?: string; permalink?: string; mediaType?: string; mediaUrl?: string; thumbnailUrl?: string;
  sizes?: Sizes; prunedCaption?: string; caption?: string; children?: unknown[];
};
type Feed = { username?: string; posts?: BPost[] };

const KEY = 'ljs-ig-feed-v1';
const TTL = 6 * 60 * 60 * 1000;
const MAX = 8;

const allowedFeed = (u: string) => /^https:\/\/feeds\.behold\.so\/[\w-]+$/.test(u) || /^http:\/\/localhost(:\d+)?\//.test(u);
const safeImg = (u?: string) => (u && /^(https:\/\/|http:\/\/localhost)/.test(u) ? u : '');
const safePost = (u?: string) => (u && /^https:\/\/(www\.)?instagram\.com\//.test(u) ? u : '');

async function load(url: string): Promise<Feed | null> {
  let cached: { t: number; feed: Feed; url: string } | null = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage blocked */ }
  if (cached && cached.url === url && Date.now() - cached.t < TTL) return cached.feed;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const feed = (await res.json()) as Feed;
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), feed: { username: feed.username, posts: (feed.posts || []).slice(0, MAX) }, url })); } catch { /* ignore */ }
    return feed;
  } catch {
    return cached && cached.url === url ? cached.feed : null; // stale copy is better than nothing
  }
}

const ICON = '<svg class="ig-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>';

function tile(p: BPost, handle: string, logo: string): HTMLElement | null {
  const href = safePost(p.permalink);
  const img = safeImg(p.sizes?.medium?.mediaUrl || p.sizes?.large?.mediaUrl || p.thumbnailUrl || p.mediaUrl);
  const day = (p.timestamp || '').slice(0, 10);
  if (!href || !img || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const a = document.createElement('a');
  a.className = 'ig-tile';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  const sr = document.createElement('span');
  sr.className = 'sr';
  const cap = (p.prunedCaption || p.caption || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  sr.textContent = (cap ? cap + '. ' : '') + 'Instagram post by ';
  a.appendChild(sr);

  const im = document.createElement('img');
  im.src = img; im.alt = ''; im.width = 800; im.height = 800; im.loading = 'lazy'; im.decoding = 'async';
  a.appendChild(im);

  const n = Array.isArray(p.children) ? p.children.length : 0;
  if (n > 1) {
    const b = document.createElement('span');
    b.className = 'ig-badge';
    b.textContent = `1/${n}`;
    a.appendChild(b);
  }

  const meta = document.createElement('span');
  meta.className = 'ig-meta';
  const mav = document.createElement('span');
  mav.className = 'ig-mav';
  if (logo) { const l = document.createElement('img'); l.src = logo; l.alt = ''; l.width = 40; l.height = 40; mav.appendChild(l); }
  const text = document.createElement('span');
  text.className = 'ig-text';
  const name = document.createElement('b');
  name.textContent = handle;
  const t = document.createElement('time');
  t.dateTime = day; t.setAttribute('data-ago', ''); t.textContent = day;
  text.append(name, t);
  meta.append(mav, text);
  meta.insertAdjacentHTML('beforeend', ICON); // fixed, trusted markup
  a.appendChild(meta);
  return a;
}

(async () => {
  const grid = document.querySelector<HTMLElement>('.ig-grid[data-feed]');
  const url = grid?.dataset.feed || '';
  if (!grid || !allowedFeed(url)) return;
  const feed = await load(url);
  const handleEl = document.querySelector('.ig-handle')?.textContent?.replace(/^@/, '') || '';
  const handle = feed?.username || handleEl;
  const logo = document.querySelector<HTMLImageElement>('.ig-av img')?.src || '';
  const tiles = (feed?.posts || []).slice(0, MAX).map((p) => tile(p, handle, logo)).filter((x): x is HTMLElement => !!x);
  if (!tiles.length) return; // keep the hand-added tiles
  grid.replaceChildren(...tiles);
  grid.dataset.n = String(tiles.length);
  grid.classList.add('ig-live');
  labelTimes(grid);
})();
