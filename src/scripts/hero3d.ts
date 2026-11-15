import {
  WebGLRenderer, Scene, Fog, PerspectiveCamera, CanvasTexture, MeshBasicMaterial, DoubleSide,
  PlaneGeometry, Group, Mesh, Color,
} from 'three';
import { state } from './state';

/** Floating paper pages in 3D, drawn over the ink video. Desktop/tablet only (see site.ts). */
export function initHero3d() {
  const cv = document.querySelector<HTMLCanvasElement>('#gl');
  const hero = document.querySelector<HTMLElement>('#hero');
  if (!cv || !hero) return;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return; // no WebGL: the video alone is the hero
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  // The usual wine and linen look is hard-coded below. When the newest issue sets its own home page colours (inline on <html>), the sheets follow them.
  const root = getComputedStyle(document.documentElement);
  const custom = !!document.documentElement.style.getPropertyValue('--accent');
  const css = (n: string) => root.getPropertyValue(n).trim();
  const C = custom
    ? { fog: css('--paper'), page: css('--card'), edge: css('--paper-2'), ink: css('--black'), tint: '#' + new Color(css('--accent')).lerp(new Color('#ffffff'), 0.55).getHexString() }
    : { fog: '#e7e2d7', page: '#F3F0E8', edge: '#BFBCB2', ink: '#251821', tint: '#b48aa0' };
  const inkRgb = (a: number) => { const c = new Color(C.ink); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };
  const scene = new Scene();
  scene.fog = new Fog(new Color(C.fog).getHex(), 9, 20);
  const cam = new PerspectiveCamera(50, 1, 0.1, 50);
  cam.position.set(0, 0, 9);

  const tex = [0, 1, 2].map((seed) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 352;
    const g = c.getContext('2d')!;
    g.fillStyle = C.page;
    g.fillRect(0, 0, 256, 352);
    g.strokeStyle = C.edge;
    g.lineWidth = 6;
    g.strokeRect(0, 0, 256, 352);
    g.fillStyle = inkRgb(0.85);
    g.fillRect(24, 36, 90 + seed * 22, 9);
    g.fillStyle = inkRgb(0.5);
    for (let i = 0; i < 15; i++) g.fillRect(24, 76 + i * 17, 110 + ((i * 57 + seed * 41) % 100), 3);
    const v = g.createRadialGradient(128, 176, 80, 128, 176, 230);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = v;
    g.fillRect(0, 0, 256, 352);
    const t = new CanvasTexture(c);
    t.anisotropy = 2;
    return t;
  });
  const mats = [
    ...tex.map((t) => new MeshBasicMaterial({ map: t, transparent: true, opacity: 0.92, side: DoubleSide, depthWrite: false })),
    new MeshBasicMaterial({ map: tex[1], color: new Color(C.tint), transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }),
  ];
  const geo = new PlaneGeometry(1.5, 2.1);
  const group = new Group();
  scene.add(group);

  const pages: Mesh[] = [];
  for (let i = 0; i < 28; i++) {
    const m = new Mesh(geo, mats[i % 4]);
    m.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 13, -10 + Math.random() * 7);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const s = 0.7 + Math.random() * 0.7;
    m.scale.set(s, s, s);
    m.userData = { vy: 0.12 + Math.random() * 0.3, rx: (Math.random() - 0.5) * 0.5, ry: (Math.random() - 0.5) * 0.6, rz: (Math.random() - 0.5) * 0.3 };
    group.add(m);
    pages.push(m);
  }

  const size = () => {
    const r = hero.getBoundingClientRect();
    const w = Math.max(1, r.width | 0);
    const h = Math.max(1, r.height | 0);
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(hero);

  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / innerWidth - 0.5;
    mouse.y = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);

  let last = performance.now();
  let hpS = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    for (const m of pages) {
      const u = m.userData;
      m.position.y += u.vy * dt;
      m.rotation.x += u.rx * dt;
      m.rotation.y += u.ry * dt;
      m.rotation.z += u.rz * dt;
      if (m.position.y > 7) m.position.y = -7;
    }
    hpS += (state.hp - hpS) * 0.08;
    group.position.y = hpS * 6;
    group.rotation.y = hpS * 1.2;
    group.rotation.z = hpS * 0.3;
    cam.position.z = 9 - hpS * 2;
    cam.position.x += (mouse.x * 2.2 - cam.position.x) * 0.04;
    cam.position.y += (-mouse.y * 1.4 - cam.position.y) * 0.04;
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
  };
  requestAnimationFrame(frame);
  cv.classList.add('ready');
}
