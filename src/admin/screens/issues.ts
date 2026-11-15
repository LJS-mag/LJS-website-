import { model, touch, files, type Issue } from '../model';
import { esc, $, field, themePicker, toast, go, bar, badge, discardFile, busy, assetUrl } from '../ui';
import { pdfPages, fileToB64 } from '../images';
import { PRESETS, checkPalette } from '../../lib/palette';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (d: string) => { const [y, m] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

export function render(el: HTMLElement, arg?: string) {
  if (arg) return form(el, arg === 'new' ? null : arg);
  const rows = [...model.issues].sort((a, b) => b.number - a.number);
  el.innerHTML = `<div class="a-list">${rows.map((i) => `
    <a class="a-row" href="#/issues/${esc(i.id)}">
      <span class="a-thumb a-cover">${i.cover ? `<img src="${esc(assetUrl(i.cover))}" alt="" loading="lazy">` : `<span class="cover ${esc(i.theme)}"></span>`}</span>
      <span class="a-body"><b>Issue ${i.number}: ${esc(i.title)}</b><small>${esc(monthLabel(i.date))} · ${i.pages.length ? i.pages.length + ' pages' : 'no pages yet'}</small></span>
      ${i.sample ? badge('Sample') : ''}<span class="a-go">Edit</span>
    </a>`).join('') || '<p class="a-empty">No issues yet. Add the first one.</p>'}</div>`;
  bar(el, 'Issues', '<a class="btn" href="#/issues/new">Add an issue</a>');
}

function form(el: HTMLElement, id: string | null) {
  const i: Issue = id ? model.issues.find((x) => x.id === id)! : { id: '', number: Math.max(0, ...model.issues.map((x) => x.number)) + 1, title: '', date: new Date().toISOString().slice(0, 7), blurb: '', theme: 'c0', pages: [] };
  if (id && !i) { el.innerHTML = '<p class="a-empty">That issue was not found.</p>'; return; }
  el.innerHTML = `
    <form class="a-form" novalidate>
      ${field('Issue number', `<input name="number" type="number" min="1" value="${i.number}" ${id ? 'readonly' : ''} required>`, id ? 'The number cannot change once published.' : '')}
      ${field('Title', `<input name="title" value="${esc(i.title)}" required>`)}
      ${field('Month published', `<input name="date" type="month" value="${esc(i.date.slice(0, 7))}" required>`)}
      ${field('Description', `<textarea name="blurb" rows="4" required>${esc(i.blurb)}</textarea>`, 'A few sentences shown on the issue page.')}
      ${themePicker(i.theme)}
      <div class="a-f a-pal">
        <span>Home page colours</span>
        <label class="a-check"><input type="checkbox" name="usepal" ${i.palette ? 'checked' : ''}><span><b>Colour the home page to match this issue</b><br><small>The home page uses these colours while this is the newest issue. Leave it off to keep the usual wine and linen.</small></span></label>
        <div class="a-palbox" ${i.palette ? '' : 'hidden'}>
          <div class="a-presets" role="group" aria-label="Ready-made colours">${PRESETS.map((p) => `<button type="button" class="a-preset" data-bg="${p.bg}" data-ac="${p.accent}" title="${esc(p.name)}" aria-label="${esc(p.name)}"><i style="background:${p.bg}"></i><i style="background:${p.accent}"></i></button>`).join('')}</div>
          <div class="a-pickers">
            <label>Background (light)<input type="color" name="pbg" value="${esc(i.palette?.bg ?? PRESETS[0].bg)}"></label>
            <label>Accent (dark)<input type="color" name="pac" value="${esc(i.palette?.accent ?? PRESETS[0].accent)}"></label>
          </div>
          <div class="a-prev" aria-hidden="true"><b>Literature &amp; Journalism</b><span>Sample button</span></div>
          <small class="a-palmsg" role="status"></small>
        </div>
      </div>
      <div class="a-f"><span>${id && i.pages.length ? 'Replace the PDF (optional)' : 'PDF of the issue'}</span>
        <input name="pdf" type="file" accept="application/pdf" ${id && i.pages.length ? '' : 'required'}>
        <small>Each page becomes an image for the book reader. Big PDFs can take a minute, and a laptop is faster than a phone. Keep the tab open until it finishes.</small></div>
      <label class="a-check"><input type="checkbox" name="keep" ${i.pdf || !id ? 'checked' : ''}><span>Also offer the PDF as a download</span></label>
      <div class="a-progress" hidden><div></div><span></span></div>
      <p class="a-err" role="alert"></p>
      <div class="a-buttons"><button class="btn" type="submit">Save issue</button><a class="btn ghost" href="#/issues">Cancel</a>${id ? '<button class="btn ghost danger" type="button" data-del>Delete issue</button>' : ''}</div>
    </form>`;
  bar(el, id ? `Issue ${i.number}` : 'New issue');
  const f = $<HTMLFormElement>('form', el);
  const err = (m: string) => { $('.a-err', el).textContent = m; };

  /* home page colours: show/hide, presets and a live preview with the same readability check the site uses */
  const usepal = $<HTMLInputElement>('input[name=usepal]', el), palbox = $('.a-palbox', el), prev = $('.a-prev', el), palmsg = $('.a-palmsg', el);
  const pbg = $<HTMLInputElement>('input[name=pbg]', el), pac = $<HTMLInputElement>('input[name=pac]', el);
  const refreshPal = () => {
    palbox.hidden = !usepal.checked;
    prev.style.setProperty('--pv-bg', pbg.value); prev.style.setProperty('--pv-ac', pac.value);
    const bad = checkPalette({ bg: pbg.value, accent: pac.value });
    palmsg.textContent = bad || 'These colours are easy to read.';
    palmsg.classList.toggle('bad', !!bad);
  };
  usepal.addEventListener('change', refreshPal); pbg.addEventListener('input', refreshPal); pac.addEventListener('input', refreshPal);
  el.querySelectorAll<HTMLElement>('.a-preset').forEach((b) => b.addEventListener('click', () => { pbg.value = b.dataset.bg!; pac.value = b.dataset.ac!; refreshPal(); }));
  refreshPal();

  const prog = $('.a-progress', el);
  const setProg = (done: number, total: number, label: string) => {
    prog.hidden = false;
    ($('div', prog) as HTMLElement).style.width = `${(done / total) * 100}%`;
    $('span', prog).textContent = `${label} ${done} of ${total}`;
  };

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const number = Number(d.get('number')), title = String(d.get('title')).trim(), date = String(d.get('date')), blurb = String(d.get('blurb')).trim();
    if (!Number.isInteger(number) || number < 1) return err('Enter the issue number.');
    if (!id && model.issues.some((x) => x.number === number)) return err(`Issue ${number} already exists.`);
    if (title.length < 2) return err('Please add a title.');
    if (!date) return err('Choose the month it was published.');
    if (blurb.length < 10) return err('The description needs at least 10 characters.');
    const pdf = (f.elements.namedItem('pdf') as HTMLInputElement).files?.[0];
    if (!id && !pdf) return err('Choose the PDF of the issue.');
    if (pdf && pdf.size > 120 * 1024 * 1024) return err('That PDF is over 120 MB. Please compress it first.');
    const palette = d.get('usepal') ? { bg: String(d.get('pbg')).toUpperCase(), accent: String(d.get('pac')).toUpperCase() } : undefined;
    if (palette) { const bad = checkPalette(palette); if (bad) return err(`Home page colours: ${bad}`); }
    const b = $<HTMLButtonElement>('button[type=submit]', el);
    busy(b, true, 'Working…');
    err('');
    try {
      const rec: Issue = i.id ? i : { ...i, id: `issue-${pad(number)}`, number };
      if (pdf) {
        const dir = `issues/${rec.id}`;
        const { pages, cover } = await pdfPages(pdf, (n, t) => setProg(n, t, 'Preparing page'));
        // drop the old images, then stage the new ones
        for (const p of rec.pages) discardFile('public/' + p, true);
        if (rec.cover) discardFile('public/' + rec.cover, true);
        if (rec.pdf) discardFile('public/' + rec.pdf, true);
        rec.pages = pages.map((p, n) => { const path = `${dir}/p-${pad(n + 1, 3)}.${p.ext}`; files.set('public/' + path, { b64: p.b64 }); return path; });
        rec.cover = `${dir}/cover.${cover.ext}`;
        files.set('public/' + rec.cover, { b64: cover.b64 });
        if (d.get('keep')) { rec.pdf = `${dir}/${rec.id}.pdf`; files.set('public/' + rec.pdf, { b64: await fileToB64(pdf) }); } else delete rec.pdf;
      } else if (!d.get('keep') && rec.pdf) { discardFile('public/' + rec.pdf, true); delete rec.pdf; }
      Object.assign(rec, { title, date, blurb, theme: String(d.get('theme') || 'c0') });
      if (palette) rec.palette = palette; else delete rec.palette;
      delete rec.sample; // edited by a person, so no longer placeholder content
      if (!i.id) model.issues.push(rec);
      touch('issues');
      toast('Saved. Press Publish when you are ready.');
      go('#/issues');
    } catch (x: any) { err(x.message || 'Could not process that file.'); busy(b, false); }
  });

  $('[data-del]', el)?.addEventListener('click', () => {
    if (!confirm(`Delete Issue ${i.number}: ${i.title}? Its pages and reviews will disappear from the site.`)) return;
    for (const p of i.pages) discardFile('public/' + p, true);
    if (i.cover) discardFile('public/' + i.cover, true);
    if (i.pdf) discardFile('public/' + i.pdf, true);
    model.issues = model.issues.filter((x) => x !== i);
    model.reviews = model.reviews.filter((r) => r.target !== `issue:${i.id}`);
    touch('issues'); touch('reviews');
    go('#/issues');
  });
}
