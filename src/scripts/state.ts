/** Scroll progress through the pinned hero (0..1), shared by site.ts (writes) and hero3d.ts (reads). */
export const state = { hp: 0 };
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
