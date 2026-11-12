import { model, touch, files, type Insta } from '../model';
import { esc, $, field, toast, go, bar, badge, today, discardFile, busy, assetUrl } from '../ui';
import { photo } from '../images';

/* The "Latest on Instagram" grid on the home page. Instagram does not let a free website read its feed,
   so the society adds each post here: the link to the post and its photo. The grid shows the newest 8. */

const ok = (u: string) => /^https:\/\/(www\.)?instagram\.com\//.test(u);

export function render(el: HTMLElement, arg?: string) {
  if (arg) return form(el, arg === 'new' ? null : arg);
  const rows = [...model.instagram].sort((a, b) => b.date.localeCompare(a.date));
  el.innerHTML = `
    <p class="a-help">${String(model.settings.instagramFeed ?? '') ? '<b>An automatic feed is connected</b> (Settings), so the home page shows your latest posts by itself. The posts below are the backup, shown only if the feed stops working.' : 'The home page shows the newest 8 posts here, in the order of their dates. Each tile opens the real post on Instagram. You can connect an automatic feed under Settings instead.'}</p>
    <div class="a-list">${rows.map((g, n) => `
      <a class="a-row" href="#/instagram/${esc(g.id)}">
        <span class="a-thumb a-sq">${g.image ? `<img src="${esc(assetUrl(g.image))}" alt="" loading="lazy">` : `<span class="cover ${esc(g.theme)}"></span>`}</span>
        <span class="a-body"><b>${esc(g.caption || 'Instagram post')}</b><small>${esc(g.date)}${g.count > 1 ? ` · ${g.count} photos` : ''}${n >= 8 ? ' · not shown (older than the newest 8)' : ''}</small></span>
        ${g.sample ? badge('Sample') : ''}<span class="a-go">Edit</span>
      </a>`).join('') || '<p class="a-empty">No posts yet. The home page shows just the Follow button until you add some.</p>'}</div>`;
  bar(el, 'Instagram', '<a class="btn" href="#/instagram/new">Add a post</a>');
}

function form(el: HTMLElement, id: string | null) {
  const g: Insta = id ? model.instagram.find((x) => x.id === id)! : { id: '', url: '', theme: 'c0', count: 1, date: today() };
  if (id && !g) { el.innerHTML = '<p class="a-empty">That post was not found.</p>'; return; }
  el.innerHTML = `
    <form class="a-form" novalidate>
      <p class="a-help"><b>How to add a post:</b> open the post on Instagram, tap Share, then Copy link, and paste it below. Save the photo to your device (press and hold on a phone) and upload it here. For a post with several photos, upload the first one.</p>
      ${field('Link to the post', `<input name="url" type="url" value="${esc(g.url)}" placeholder="https://www.instagram.com/p/…" required autocomplete="off" spellcheck="false">`)}
      <div class="a-f"><span>Photo</span>
        <div class="a-photo">${g.image ? `<img src="${esc(assetUrl(g.image))}" alt="">` : '<div class="a-noimg">No photo yet</div>'}<input name="image" type="file" accept="image/*"></div>
        <small>It is cropped to a square and shrunk automatically.</small></div>
      <div class="a-two">
        ${field('Posted on', `<input name="date" type="date" value="${esc(g.date)}" required>`)}
        ${field('Photos in the post', `<input name="count" type="number" min="1" max="20" value="${g.count}">`)}
      </div>
      ${field('Short caption (optional)', `<input name="caption" maxlength="100" value="${esc(g.caption ?? '')}">`, 'Not shown on the tile. It is read aloud by screen readers.')}
      <p class="a-err" role="alert"></p>
      <div class="a-buttons"><button class="btn" type="submit">Save post</button><a class="btn ghost" href="#/instagram">Cancel</a>${id ? '<button class="btn ghost danger" type="button" data-del>Remove</button>' : ''}</div>
    </form>`;
  bar(el, id ? 'Edit post' : 'Add an Instagram post');
  const f = $<HTMLFormElement>('form', el);
  const err = (m: string) => { $('.a-err', el).textContent = m; };
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const url = String(d.get('url')).trim(), date = String(d.get('date')), count = Number(d.get('count')) || 1;
    if (!ok(url)) return err('Paste the link from Instagram. It should start with https://www.instagram.com/');
    if (!date) return err('Choose the date it was posted.');
    if (count < 1 || count > 20) return err('Photos in the post must be between 1 and 20.');
    const file = (f.elements.namedItem('image') as HTMLInputElement).files?.[0];
    if (!g.image && !file) return err('Upload the photo so the tile has a picture.');
    const b = $<HTMLButtonElement>('button[type=submit]', el);
    busy(b, true, 'Saving…');
    try {
      const rec: Insta = g.id ? g : { ...g, id: 'ig-' + Date.now().toString(36) };
      if (file) {
        const img = await photo(file, 800, 800);
        if (rec.image) discardFile('public/' + rec.image);
        const path = `media/instagram/${rec.id}.${img.ext}`;
        files.set('public/' + path, { b64: img.b64 });
        rec.image = path;
      }
      Object.assign(rec, { url, date, count, caption: String(d.get('caption')).trim() || undefined });
      delete rec.sample;
      if (!g.id) model.instagram.push(rec);
      touch('instagram');
      toast('Saved. Press Publish when you are ready.');
      go('#/instagram');
    } catch (x: any) { err(x.message || 'Could not save.'); busy(b, false); }
  });
  $('[data-del]', el)?.addEventListener('click', () => {
    if (!confirm('Remove this post from the home page?')) return;
    if (g.image) discardFile('public/' + g.image);
    model.instagram = model.instagram.filter((x) => x !== g);
    touch('instagram');
    go('#/instagram');
  });
}
