import { THEMES, files, repoFiles } from './model';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'item';
export const uniqueId = (base: string, taken: (id: string) => boolean) => { let id = base, n = 2; while (taken(id)) id = `${base}-${n++}`; return id; };
export const today = () => new Date().toISOString().slice(0, 10);
export const go = (hash: string) => { location.hash = hash; };
/** URL of a file that is part of the published site (the admin lives in <site>/admin/). */
export const siteUrl = (p = '') => new URL('../' + p, location.href).href;

let tt: number | undefined;
export function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  let t = document.getElementById('a-toast');
  if (!t) { t = document.createElement('div'); t.id = 'a-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `show ${kind}`;
  clearTimeout(tt);
  tt = window.setTimeout(() => (t!.className = ''), kind === 'err' ? 7000 : 2800);
}

export const field = (label: string, control: string, hint = '') => `<label class="a-f"><span>${label}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
export const themePicker = (value: string) =>
  `<div class="a-f"><span>Cover colour</span><div class="a-themes" role="radiogroup" aria-label="Cover colour">${THEMES.map((t) => `<label class="a-sw"><input type="radio" name="theme" value="${t}" ${t === value ? 'checked' : ''}><span class="cover ${t}" title="${t}"></span></label>`).join('')}</div></div>`;

/** Stage a file for publishing, or drop it if it was only ever staged (never published). */
export function discardFile(path: string, _legacy?: boolean) {
  if (repoFiles.has(path)) files.set(path, { del: true });
  else files.delete(path);
}

export function bar(el: HTMLElement, title: string, actionsHtml = '') {
  el.insertAdjacentHTML('afterbegin', `<div class="a-head"><h1>${esc(title)}</h1><div class="a-actions">${actionsHtml}</div></div>`);
}
export const badge = (t: string) => `<span class="a-badge">${esc(t)}</span>`;
export const busy = (b: HTMLButtonElement, on: boolean, label?: string) => {
  if (on) { b.dataset.l = b.textContent!; b.disabled = true; if (label) b.textContent = label; }
  else { b.disabled = false; b.textContent = b.dataset.l ?? b.textContent; }
};

/** Preview URL for an image: the staged (not yet published) copy if there is one, else the live site. */
export function assetUrl(rel: string) {
  const f = files.get('public/' + rel);
  if (f?.b64) return `data:image/${rel.endsWith('.webp') ? 'webp' : 'jpeg'};base64,${f.b64}`;
  return siteUrl(rel);
}
