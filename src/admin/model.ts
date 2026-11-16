import type { GitHub, FileChange } from './github';

/* Everything the admin edits, held in memory, written back to the repo as one commit when she presses Publish.
   Unpublished changes are also kept on this device (IndexedDB) so closing the tab does not lose them. */

export type Group = 'leadership' | 'writers' | 'designers';
export type Team = { id: string; name: string; role: string; group: Group; photo?: string; bio?: string; order: number };
export type Issue = { id: string; number: number; title: string; date: string; blurb: string; theme: string; palette?: { bg: string; accent: string }; cover?: string; pages: string[]; pdf?: string; sample?: boolean };
export type Review = { id: string; target: string; name: string; rating: number; text: string; date: string; status: 'approved' | 'hidden'; sample?: boolean };
export type Post = { id: string; title: string; author: string; category: string; date: string; theme: string; cover?: string; excerpt?: string; sample?: boolean; body: string };
export type Insta = { id: string; url: string; image?: string; theme: string; count: number; date: string; caption?: string; sample?: boolean };
export type Settings = {
  siteName: string; tagline: string; applicationsOpen: boolean; contactEmail: string; formRelayKey: string;
  social: { instagram?: string; spotify?: string; substack?: string; tiktok?: string; youtube?: string };
  stats: { value: string; label: string }[]; about: string; teamIntro: { writers: string; designers: string };
  [k: string]: unknown;
};

export const THEMES = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
export const CATEGORIES = ['Poetry', 'Journalism', 'Essay', 'Interview'];

export const model = {
  team: [] as Team[], issues: [] as Issue[], reviews: [] as Review[], posts: [] as Post[], instagram: [] as Insta[],
  settings: null as unknown as Settings,
};
export const dirty = { team: false, issues: false, reviews: false, settings: false, instagram: false, posts: new Set<string>() };
export const removedPosts = new Set<string>();
/** Posts that exist in the repo right now (so deleting a never-published draft does not try to delete a missing file). */
export const repoPosts = new Set<string>();
/** Image/PDF paths that exist in the repo right now, so removing something never tries to delete a file that is not there. */
export const repoFiles = new Set<string>();
/** Binary files waiting to be published (page images, photos, covers, PDFs). Keys are repo paths. */
export const files = new Map<string, { b64?: string; del?: boolean }>();
let baseHead = '';
export const getHead = () => baseHead;

const P = { team: 'content/team.json', issues: 'content/issues.json', reviews: 'content/reviews.json', instagram: 'content/instagram.json', settings: 'content/settings.json', posts: 'content/posts' };

/* ---------- posts as markdown files ---------- */
export function parsePost(slug: string, text: string): Post {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  const fm: Record<string, any> = {};
  for (const line of (m?.[1] ?? '').split(/\r?\n/)) {
    const k = /^(\w+):\s*(.*)$/.exec(line);
    if (!k) continue;
    try { fm[k[1]] = JSON.parse(k[2]); } catch { fm[k[1]] = k[2]; }
  }
  return { id: slug, title: fm.title ?? slug, author: fm.author ?? '', category: fm.category ?? 'Essay', date: String(fm.date ?? ''), theme: fm.theme ?? 'c0', cover: fm.cover, excerpt: fm.excerpt, sample: fm.sample === true, body: (m?.[2] ?? text).trim() };
}
export function serializePost(p: Post): string {
  const l = [`title: ${JSON.stringify(p.title)}`, `author: ${JSON.stringify(p.author)}`, `category: ${p.category}`, `date: "${p.date}"`, `theme: ${p.theme}`];
  if (p.cover) l.push(`cover: ${JSON.stringify(p.cover)}`);
  if (p.excerpt) l.push(`excerpt: ${JSON.stringify(p.excerpt)}`);
  if (p.sample) l.push('sample: true');
  return `---\n${l.join('\n')}\n---\n\n${p.body.trim()}\n`;
}

/* ---------- load ---------- */
export async function loadAll(gh: GitHub) {
  baseHead = await gh.head();
  const json = async (p: string) => JSON.parse((await gh.getText(p)) ?? 'null');
  const [team, issues, reviews, settings, posts, instagram] = await Promise.all([json(P.team), json(P.issues), json(P.reviews), json(P.settings), gh.list(P.posts), json(P.instagram)]);
  model.team = team ?? []; model.issues = issues ?? []; model.reviews = reviews ?? []; model.settings = settings; model.instagram = instagram ?? [];
  model.posts = (await Promise.all(posts.filter((f) => f.name.endsWith('.md')).map(async (f) => parsePost(f.name.replace(/\.md$/, ''), (await gh.getText(f.path)) ?? '')))).sort((a, b) => b.date.localeCompare(a.date));
  repoPosts.clear(); model.posts.forEach((p) => repoPosts.add(p.id));
  repoFiles.clear();
  for (const t of model.team) if (t.photo) repoFiles.add('public/media/team/' + t.photo);
  for (const i of model.issues) for (const f of [...i.pages, i.cover, i.pdf]) if (f) repoFiles.add('public/' + f);
  for (const p of model.posts) if (p.cover) repoFiles.add('public/' + p.cover);
  for (const g of model.instagram) if (g.image) repoFiles.add('public/' + g.image);
  dirty.team = dirty.issues = dirty.reviews = dirty.settings = dirty.instagram = false;
  dirty.posts.clear(); removedPosts.clear(); files.clear();
}

/* ---------- what will be published ---------- */
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
export function pendingChanges(): FileChange[] {
  const out: FileChange[] = [];
  if (dirty.team) out.push({ path: P.team, text: json([...model.team].sort((a, b) => a.order - b.order)) });
  if (dirty.issues) out.push({ path: P.issues, text: json([...model.issues].sort((a, b) => b.number - a.number)) });
  if (dirty.reviews) out.push({ path: P.reviews, text: json(model.reviews) });
  if (dirty.settings) out.push({ path: P.settings, text: json(model.settings) });
  if (dirty.instagram) out.push({ path: P.instagram, text: json([...model.instagram].sort((a, b) => b.date.localeCompare(a.date))) });
  for (const slug of dirty.posts) { const p = model.posts.find((x) => x.id === slug); if (p) out.push({ path: `${P.posts}/${slug}.md`, text: serializePost(p) }); }
  for (const slug of removedPosts) out.push({ path: `${P.posts}/${slug}.md`, del: true });
  for (const [path, f] of files) out.push({ path, b64: f.b64, del: f.del });
  return out;
}
export const changeCount = () => [dirty.team, dirty.issues, dirty.reviews, dirty.settings, dirty.instagram].filter(Boolean).length + dirty.posts.size + removedPosts.size + (files.size ? 1 : 0);

/* ---------- validation: same rules as src/content.config.ts, so a bad edit never reaches the build ---------- */
export function validate(): string[] {
  const e: string[] = [];
  const ids = new Set<string>();
  for (const t of model.team) {
    if (!(t.name?.trim().length >= 2)) e.push('A team member needs a name.');
    if (!(t.role?.trim().length >= 2)) e.push(`${t.name}: add a role.`);
    if (!['leadership', 'writers', 'designers'].includes(t.group)) e.push(`${t.name}: choose a group.`);
  }
  for (const i of model.issues) {
    if (ids.has(i.id)) e.push(`Issue ${i.number} is listed twice.`);
    ids.add(i.id);
    if (!Number.isInteger(i.number) || i.number < 1) e.push('An issue needs a number.');
    if (!(i.title?.trim().length >= 2)) e.push(`Issue ${i.number}: add a title.`);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(i.date)) e.push(`Issue ${i.number}: choose a month.`);
    if (!(i.blurb?.trim().length >= 10)) e.push(`Issue ${i.number}: the description needs at least 10 characters.`);
  }
  for (const p of model.posts) {
    if (!(p.title?.trim().length >= 2)) e.push('A post needs a title.');
    if (!(p.author?.trim().length >= 2)) e.push(`"${p.title}": add the author.`);
    if (!CATEGORIES.includes(p.category)) e.push(`"${p.title}": choose a category.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) e.push(`"${p.title}": choose a date.`);
  }
  for (const r of model.reviews) {
    if (!/^(issue|post):[a-z0-9-]+$/.test(r.target)) e.push(`A review points at "${r.target}", which is not valid.`);
    if (!(r.rating >= 1 && r.rating <= 5)) e.push(`${r.name}: rating must be 1 to 5.`);
    if (!(r.text?.length >= 10 && r.text.length <= 600)) e.push(`${r.name}: the review must be 10 to 600 characters.`);
  }
  for (const g of model.instagram) {
    if (!/^https:\/\/(www\.)?instagram\.com\//.test(g.url)) e.push('An Instagram post needs a link that starts with https://www.instagram.com/');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.date)) e.push('An Instagram post needs a date.');
    if (!(g.count >= 1 && g.count <= 20)) e.push('The number of photos in an Instagram post must be 1 to 20.');
  }
  const s = model.settings;
  if (s.contactEmail && !/^\S+@\S+\.\S+$/.test(s.contactEmail)) e.push('Settings: the contact email does not look right.');
  if (s.instagramFeed && !/^https:\/\/feeds\.behold\.so\/[\w-]+$/.test(String(s.instagramFeed))) e.push('Settings: the Instagram feed link should start with https://feeds.behold.so/');
  for (const st of s.stats) if (!st.value?.trim() || !st.label?.trim()) e.push('Settings: every number needs a value and a label.');
  return e;
}

/* ---------- unpublished work kept on this device ---------- */
const DB = 'ljs-admin-draft';
const idb = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const kv = async (mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest) => {
  const db = await idb();
  return new Promise<any>((res, rej) => { const rq = f(db.transaction('kv', mode).objectStore('kv')); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
};
let timer: number | undefined;
export function touch(kind: 'team' | 'issues' | 'reviews' | 'settings' | 'instagram' | { post: string }) {
  if (typeof kind === 'string') dirty[kind] = true; else dirty.posts.add(kind.post);
  clearTimeout(timer);
  timer = window.setTimeout(saveDraft, 600);
  window.dispatchEvent(new Event('ljs-changed'));
}
export async function saveDraft() {
  try {
    if (!changeCount()) return await kv('readwrite', (s) => s.delete('draft'));
    await kv('readwrite', (s) => s.put({ head: baseHead, model: JSON.parse(JSON.stringify(model)), dirty: { ...dirty, posts: [...dirty.posts] }, removed: [...removedPosts], files: [...files] }, 'draft'));
  } catch { /* private mode etc: drafts just will not survive a reload */ }
}
export const clearDraft = () => kv('readwrite', (s) => s.delete('draft')).catch(() => {});
export async function restoreDraft(): Promise<'none' | 'restored' | 'stale'> {
  let d: any;
  try { d = await kv('readonly', (s) => s.get('draft')); } catch { return 'none'; }
  if (!d) return 'none';
  if (d.head !== baseHead) return 'stale';
  Object.assign(model, d.model);
  Object.assign(dirty, { ...d.dirty, posts: new Set(d.dirty.posts) });
  removedPosts.clear(); d.removed.forEach((x: string) => removedPosts.add(x));
  files.clear(); d.files.forEach(([k, v]: [string, any]) => files.set(k, v));
  return 'restored';
}
export function backup() {
  return { exportedAt: new Date().toISOString(), team: model.team, issues: model.issues, reviews: model.reviews, settings: model.settings, posts: model.posts, instagram: model.instagram };
}
