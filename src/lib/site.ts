import { getCollection } from 'astro:content';
import raw from '../../content/settings.json';

export const S = raw as {
  siteName: string;
  tagline: string;
  applicationsOpen: boolean;
  contactEmail: string;
  formRelayKey: string;
  instagramFeed: string;
  /** Optional link to the society's own Google Form. When set, the Apply page sends people there instead of using the built-in form. */
  applyFormUrl?: string;
  social: { instagram?: string; spotify?: string; tiktok?: string; youtube?: string };
  stats: { value: string; label: string }[];
  about: string;
  teamIntro: { writers: string; designers: string };
};

/** Prefix a path with the site base (needed when hosted under a sub-path such as /ljs-site). */
export const url = (p = '') => {
  const b = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return b + p.replace(/^\//, '');
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtMonth = (d: string) => {
  const [y, m] = d.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const fmtDay = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

export async function getIssues() {
  const all = await getCollection('issues');
  return all.sort((a, b) => b.data.number - a.data.number);
}
export async function getPosts() {
  const all = await getCollection('posts');
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date));
}
export async function getTeam() {
  const all = await getCollection('team');
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** Newest Instagram posts the society has added (shown as a grid on the home page). */
export async function getInstagram(limit = 8) {
  const all = await getCollection('instagram');
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date)).slice(0, limit);
}
/** "literatureandjournalismsociety" from an Instagram profile link. */
export const handleOf = (link?: string) => (link ? link.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '' : '');

export type Rating = { n: number; avg: number; items: { id: string; name: string; rating: number; text: string; date: string }[] };
/** Approved reviews grouped by target ("issue:issue-04", "post:slug"), newest first, with average and count. */
export async function getRatings(): Promise<Map<string, Rating>> {
  const all = (await getCollection('reviews')).filter((r) => r.data.status === 'approved');
  const map = new Map<string, Rating>();
  for (const r of all) {
    const g = map.get(r.data.target) ?? { n: 0, avg: 0, items: [] };
    g.items.push({ id: r.id, name: r.data.name, rating: r.data.rating, text: r.data.text, date: r.data.date });
    map.set(r.data.target, g);
  }
  for (const g of map.values()) {
    g.items.sort((a, b) => b.date.localeCompare(a.date));
    g.n = g.items.length;
    g.avg = g.items.reduce((s, x) => s + x.rating, 0) / g.n;
  }
  return map;
}
export const noRating: Rating = { n: 0, avg: 0, items: [] };

/** Split a headline into letters so each can scatter on scroll (see .ht .ch in global.css). */
export function splitTitle(lines: string[][]): string {
  let n = 0;
  const rnd = (i: number) => {
    const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const word = (w: string) =>
    `<span class="w">${[...w]
      .map((c) => {
        n++;
        const dx = ((rnd(n) - 0.5) * 34).toFixed(1);
        const dy = ((rnd(n + 50) - 0.5) * 160 - 40).toFixed(0);
        const r = ((rnd(n + 99) - 0.5) * 40).toFixed(0);
        return `<span class="ch" aria-hidden="true" style="--dx:${dx};--dy:${dy};--r:${r}">${c === '&' ? '&amp;' : c}</span>`;
      })
      .join('')}</span>`;
  return lines.map((ws) => ws.map((w) => (w.startsWith('*') ? `<em>${word(w.slice(1))}</em>` : word(w))).join(' ')).join('<br>');
}
