/* Image work done in the browser, so no server is needed: resize photos, and turn a PDF into page images. */

export type Img = { b64: string; ext: 'webp' | 'jpg'; bytes: number };

const blobToB64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

/** WebP when the browser can make it (older Safari falls back to JPEG). */
async function encode(c: HTMLCanvasElement, q: number): Promise<Img> {
  let blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/webp', q));
  let ext: 'webp' | 'jpg' = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    ext = 'jpg';
  }
  return { b64: await blobToB64(blob!), ext, bytes: blob!.size };
}

/** Resize and crop (centre) to exactly w x h. Used for team photos (4:5), covers and post images. */
export async function photo(file: File, w: number, h: number, q = 0.8): Promise<Img> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const s = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * s, dh = bmp.height * s;
  ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  bmp.close();
  return encode(c, q);
}

/** Render every page of a PDF to an image. Slow on phones but works; a laptop is better for big files. */
export async function pdfPages(file: File, onProgress: (done: number, total: number) => void): Promise<{ pages: Img[]; cover: Img }> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Img[] = [];
  let cover: Img | null = null;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(1200 / base.width, 2.5) });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d')!;
    await page.render({ canvas: c, canvasContext: ctx, viewport: vp } as any).promise;
    pages.push(await encode(c, 0.78));
    if (n === 1) {
      const cc = document.createElement('canvas');
      cc.width = 600; cc.height = 800;
      const k = Math.max(600 / c.width, 800 / c.height);
      cc.getContext('2d')!.drawImage(c, (600 - c.width * k) / 2, (800 - c.height * k) / 2, c.width * k, c.height * k);
      cover = await encode(cc, 0.8);
    }
    c.width = c.height = 0; // free memory on phones
    onProgress(n, pdf.numPages);
  }
  return { pages, cover: cover! };
}

export const fileToB64 = (f: File) => blobToB64(f);
