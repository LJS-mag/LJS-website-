/* Token expiry reminder.
   GitHub does not let a web page read a token's expiry date from its replies (the header is not exposed to browsers),
   so the admin asks for the date once when the device is set up (it is shown on the token page next to "Expires on"),
   keeps it on this device, and warns well before it passes. The date is not a secret. */

const KEY = 'ljs-admin-token-expiry';
const DAY = 86_400_000;
export const WARN_DAYS = 30;

const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
export const getExpiry = (): string | null => { try { const v = localStorage.getItem(KEY); return v && valid(v) ? v : null; } catch { return null; } };
export const setExpiry = (d: string) => { try { localStorage.setItem(KEY, d); } catch { /* storage blocked: the reminder is simply off */ } };
export const clearExpiry = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A sensible starting value for the setup form: just under a year from today (the length the instructions ask for). */
export const suggestedExpiry = (now = new Date()) => ymd(new Date(now.getTime() + 364 * DAY));

/** Whole days until the token stops working. The expiry day itself counts as over, to stay on the safe side. */
export const daysLeft = (d: string, now = new Date()) => Math.ceil((new Date(`${d}T00:00:00`).getTime() - now.getTime()) / DAY);

export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';
export function expiryState(now = new Date()): { state: ExpiryState; date?: string; days?: number } {
  const date = getExpiry();
  if (!date) return { state: 'none' };
  const days = daysLeft(date, now);
  return { state: days <= 0 ? 'expired' : days <= WARN_DAYS ? 'soon' : 'ok', date, days };
}

/** Error text for a date typed into a form, or '' when it is fine. */
export function checkExpiry(d: string, now = new Date()): string {
  if (!valid(d)) return 'Pick the date shown next to "Expires on" on the GitHub token page.';
  if (daysLeft(d, now) <= 0) return 'That date has already passed. Make a new token that lasts a year, then use its date.';
  return '';
}

export const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Set when GitHub answers "bad credentials" during this session (the token ran out, was removed, or was replaced). */
let authProblem = false;
export const markAuthProblem = () => { authProblem = true; window.dispatchEvent(new Event('ljs-expiry')); };
export const clearAuthProblem = () => { authProblem = false; window.dispatchEvent(new Event('ljs-expiry')); };
export const hasAuthProblem = () => authProblem;

export const RENEW_STEPS = `<details class="a-how"><summary>How to renew the token</summary><ol>
  <li>Sign in to GitHub, then open <b>Settings</b> &gt; <b>Developer settings</b> &gt; <b>Personal access tokens</b> &gt; <b>Fine-grained tokens</b>.</li>
  <li>Open the token called "Website admin" and choose <b>Regenerate token</b>, with an expiry one year from today. (If it is not in the list, make a new one: name "Website admin", only this repository, <b>Contents: Read and write</b>, <b>Actions: Read-only</b>.)</li>
  <li>Copy the new token. Here, press <b>Lock</b>, choose <b>Set this device up again</b>, paste the token, and enter the new expiry date.</li>
  <li>Do the same on your phone.</li>
</ol></details>`;
