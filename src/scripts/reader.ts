import { reduceMotion } from './state';

/* Book reader. Two-page spreads with a page-turn on wide screens, single pages on phones.
   Real issues provide page images; an issue without images shows sample pages so the layout can be checked. */

type Data = { id: string; title: string; label: string; pages: string[]; back: string };
const data: Data = JSON.parse(document.getElementById('reader-data')!.textContent!);
const coverHtml = (document.getElementById('reader-cover') as HTMLTemplateElement).innerHTML;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;

const hasImages = data.pages.length > 0;
const total = hasImages ? data.pages.length : 12;

const LOREM = [
  'A page begins with a single line, and the line begins with someone brave enough to write it down.',
  'We carry our rituals the way we carry our keys: without noticing, until the day we cannot find them.',
  'The morning light arrives the same as ever, but the room has changed, and so have we.',
];
const POEM = 'the kettle learns my name\nthe window learns the rain\nand every small return\nis a way of saying again';

function pageHtml(n: number): string | null {
  if (n < 0 || n >= total) return null;
  if (hasImages) {
    return `<div class="pg img"><img src="${data.pages[n]}" alt="Page ${n + 1} of ${total}" decoding="async" draggable="false"></div>`;
  }
  if (n === 0) return `<div class="pg cv">${coverHtml}</div>`;
  if (n === total - 1) return `<div class="pg" style="justify-content:center;text-align:center"><h4>Thank you for reading</h4><p>Sample page.</p><div class="num">${n + 1}</div></div>`;
  const t = n % 3;
  const body =
    t === 0
      ? `<div class="kick">Poetry</div><h4>The kettle learns my name</h4><p class="poem">${POEM}</p>`
      : t === 1
        ? `<div class="kick">Essay</div><h4>On beginning again</h4><p>${LOREM[0]}</p><p>${LOREM[1]}</p>`
        : `<div class="kick">Journalism</div><h4>What the campus remembers</h4><p>${LOREM[2]}</p><p>${LOREM[0]}</p>`;
  return `<div class="pg">${body}<div class="num">${n + 1}</div></div>`;
}

const half = (cls: string, html: string | null) => `<div class="half ${cls}${html ? '' : ' blank'}">${html || ''}</div>`;
const spreads = () => Math.floor(total / 2) + 1;

const R = { k: 0, p: 0, busy: false, single: false };
const book = $('#book');
const reader = $('#reader');

/* Shape the book like the real pages (A5, A4, square...) so nothing is cropped and margins stay equal on all four sides. */
let pr = 0.75;
function shape() {
  reader.style.setProperty('--pr', String(pr));
  book.style.aspectRatio = String(R.single ? pr : 2 * pr);
}
if (hasImages) {
  const probe = new Image();
  probe.onload = () => {
    if (probe.naturalWidth && probe.naturalHeight) {
      pr = probe.naturalWidth / probe.naturalHeight;
      shape();
    }
  };
  probe.src = data.pages[0];
}

function warm(n: number) {
  // start loading the next pages so turning feels instant
  if (!hasImages) return;
  for (const i of [n, n + 1, n + 2, n + 3]) if (data.pages[i]) new Image().src = data.pages[i];
}

function render() {
  R.single = innerWidth < 800;
  reader.classList.toggle('single', R.single);
  shape();
  if (R.single) {
    book.innerHTML = half('r', pageHtml(R.p));
    $('#rCount').textContent = `Page ${R.p + 1} of ${total}`;
    ($('#mPrev') as HTMLButtonElement).disabled = R.p <= 0;
    ($('#mNext') as HTMLButtonElement).disabled = R.p >= total - 1;
    warm(R.p + 1);
    return;
  }
  const k = R.k;
  book.innerHTML = half('l', pageHtml(2 * k - 1)) + half('r', pageHtml(2 * k));
  $('#rCount').textContent = k === 0 ? `Cover · ${total} pages` : `Pages ${2 * k} to ${Math.min(2 * k + 1, total)} of ${total}`;
  ($('#rPrev') as HTMLButtonElement).disabled = k <= 0;
  ($('#rNext') as HTMLButtonElement).disabled = k >= spreads() - 1;
  warm(2 * k + 2);
}

function go(d: number) {
  if (R.single) {
    const n = R.p + d;
    if (n < 0 || n >= total) return;
    R.p = n;
    render();
    return;
  }
  if (R.busy) return;
  const k = R.k;
  const nk = k + d;
  if (nk < 0 || nk >= spreads()) return;
  if (reduceMotion()) {
    R.k = nk;
    render();
    return;
  }
  R.busy = true;
  const leaf = document.createElement('div');
  if (d > 0) {
    book.innerHTML = half('l', pageHtml(2 * k - 1)) + half('r', pageHtml(2 * nk));
    leaf.className = 'leaf fwd';
    leaf.innerHTML = `<div class="face front">${pageHtml(2 * k) || ''}</div><div class="face back">${pageHtml(2 * k + 1) || ''}</div>`;
  } else {
    book.innerHTML = half('l', pageHtml(2 * nk - 1)) + half('r', pageHtml(2 * k));
    leaf.className = 'leaf bwd';
    leaf.innerHTML = `<div class="face front">${pageHtml(2 * k - 1) || ''}</div><div class="face back">${pageHtml(2 * k - 2) || ''}</div>`;
  }
  book.appendChild(leaf);
  requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('go')));
  setTimeout(() => {
    R.k = nk;
    R.busy = false;
    render();
  }, 880);
}

$('#rPrev').onclick = () => go(-1);
$('#rNext').onclick = () => go(1);
$('#mPrev').onclick = () => go(-1);
$('#mNext').onclick = () => go(1);
$('#rFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : reader.requestFullscreen?.());
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'Escape' && !document.fullscreenElement) location.href = data.back;
});

// touch swipe on phones
let sx = 0;
book.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
book.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
});

let rt: number;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    if (R.busy) return;
    if (innerWidth < 800) R.p = Math.max(0, 2 * R.k - (R.k ? 1 : 0));
    else R.k = Math.floor((R.p + 1) / 2);
    render();
  }, 150);
});

render();
