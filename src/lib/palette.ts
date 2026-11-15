/* Home page colours chosen per issue. Used by the site (build time) and by the admin (live check), so both always agree.
   The society picks two colours: a light BACKGROUND and a dark ACCENT. Everything else is worked out from those two,
   and a pair that would be hard to read is refused. */

export type Palette = { bg: string; accent: string };

export const INK = '#0E0C0D'; // body text colour; never changes

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Ready-made colour sets for the admin. The first one is the normal site look. */
export const PRESETS: { name: string; bg: string; accent: string }[] = [
  { name: 'Wine and linen', bg: '#E7E2D7', accent: '#431B2D' },
  { name: 'Forest', bg: '#E3E8DB', accent: '#1F3D2B' },
  { name: 'Ocean', bg: '#DCE6EA', accent: '#17394D' },
  { name: 'Rose', bg: '#F0E1DD', accent: '#7A2638' },
  { name: 'Gold and ink', bg: '#EDE5D0', accent: '#4A3A12' },
  { name: 'Dusk', bg: '#E3E3EA', accent: '#2B2F4A' },
];

type RGB = [number, number, number];
const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function lum(c: RGB) {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
export function contrast(a: string, b: string) {
  const x = lum(rgb(a)), y = lum(rgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Empty string when the pair is fine, otherwise a plain-language reason. */
export function checkPalette(p: Palette): string {
  if (!HEX.test(p.bg) || !HEX.test(p.accent)) return 'Pick both colours.';
  if (contrast(INK, p.bg) < 7) return 'The background is too dark for black text. Pick a lighter background.';
  if (contrast(p.accent, p.bg) < 4.5) return 'The accent is too close to the background, so buttons and headings would be hard to read. Pick a darker accent.';
  return '';
}

const triple = (c: RGB) => c.map((v) => Math.round(v)).join(' ');

/** CSS variables for <html style>. Returns null when there is no usable palette (the usual look is kept). */
export function paletteVars(p?: Palette | null): { style: string; themeColor: string; duo: { r: string; g: string; b: string } } | null {
  if (!p || checkPalette(p)) return null;
  const bg = rgb(p.bg), ac = rgb(p.accent);
  const paper2 = mix(bg, [0, 0, 0], 0.17);
  const card = mix(bg, [255, 255, 255], 0.42);
  const dark = mix(ac, [0, 0, 0], 0.45);
  const v: Record<string, string> = {
    '--paper': hex(bg), '--paper-2': hex(paper2), '--card': hex(card),
    '--accent': hex(ac), '--accent-ink': hex(bg), '--black': hex(dark), '--on-black': hex(bg),
    '--paper-rgb': triple(bg), '--paper2-rgb': triple(paper2), '--accent-rgb': triple(ac), '--black-rgb': triple(dark),
  };
  // Duotone for the hero video: the video is a two-colour ink film (wine ink on linen), so its brightness is mapped from accent (dark) to background (light).
  const LO = 0.144, HI = 0.887; // brightness of the film's ink and paper
  const steps = 9;
  const ch = (i: number) => Array.from({ length: steps }, (_, k) => {
    const t = Math.max(0, Math.min(1, (k / (steps - 1) - LO) / (HI - LO)));
    return ((ac[i] + (bg[i] - ac[i]) * t) / 255).toFixed(4);
  }).join(' ');
  return {
    style: Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';'),
    themeColor: hex(bg),
    duo: { r: ch(0), g: ch(1), b: ch(2) },
  };
}
