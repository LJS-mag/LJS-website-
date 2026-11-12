/* The GitHub token never sits on the device in plain text: it is encrypted with a key derived from the PIN
   (PBKDF2 -> AES-GCM). The PIN guards against someone casually opening the page on a shared or lost device.
   The real safety net is that the token can only touch this one repository and can be revoked in GitHub. */

const KEY = 'ljs-admin-v1';
const enc = new TextEncoder();
const dec = new TextDecoder();

export type RepoCfg = { owner: string; name: string; branch: string; api: string };
type Stored = { repo: RepoCfg; salt: string; iv: string; data: string };

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 250_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const hasSetup = () => !!localStorage.getItem(KEY);
export const getRepo = (): RepoCfg | null => {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Stored).repo : null;
};

export async function saveSetup(repo: RepoCfg, token: string, pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));
  const s: Stored = { repo, salt: b64(salt), iv: b64(iv), data: b64(data) };
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Returns the token, or null when the PIN is wrong. */
export async function unlock(pin: string): Promise<string | null> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const s = JSON.parse(raw) as Stored;
  try {
    const key = await deriveKey(pin, unb64(s.salt));
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) as BufferSource }, key, unb64(s.data) as BufferSource);
    return dec.decode(out);
  } catch {
    return null;
  }
}

export const forgetDevice = () => localStorage.removeItem(KEY);
