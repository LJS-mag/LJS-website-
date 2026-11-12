import { model, touch, files, dirty, removedPosts, repoPosts, CATEGORIES, type Post } from '../model';
import { esc, $, field, themePicker, slugify, uniqueId, toast, go, bar, badge, today, discardFile, busy, assetUrl } from '../ui';
import { photo } from '../images';

export function render(el: HTMLElement, arg?: string) {
  if (arg) return form(el, arg === 'new' ? null : arg);
  const rows = [...model.posts].sort((a, b) => b.date.localeCompare(a.date));
  el.innerHTML = `<div class="a-list">${rows.map((p) => `
    <a class="a-row" href="#/journal/${esc(p.id)}">
      <span class="a-thumb a-cover">${p.cover ? `<img src="${esc(assetUrl(p.cover))}" alt="" loading="lazy">` : `<span class="cover ${esc(p.theme)}"></span>`}</span>
      <span class="a-body"><b>${esc(p.title)}</b><small>${esc(p.category)} · ${esc(p.author)} · ${esc(p.date)}</small></span>
      ${p.sample ? badge('Sample') : ''}<span class="a-go">Edit</span>
    </a>`).join('') || '<p class="a-empty">No posts yet. The journal page stays empty until you add one.</p>'}</div>`;
  bar(el, 'Journal', '<a class="btn" href="#/journal/new">Write a post</a>');
}

function form(el: HTMLElement, id: string | null) {
  const p: Post = id ? model.posts.find((x) => x.id === id)! : { id: '', title: '', author: '', category: 'Essay', date: today(), theme: 'c0', body: '' };
  if (id && !p) { el.innerHTML = '<p class="a-empty">That post was not found.</p>'; return; }
  el.innerHTML = `
    <form class="a-form" novalidate>
      ${field('Title', `<input name="title" value="${esc(p.title)}" required>`)}
      ${field('Author', `<input name="author" value="${esc(p.author)}" required autocomplete="off">`)}
      ${field('Category', `<select name="category">${CATEGORIES.map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
      ${field('Date', `<input name="date" type="date" value="${esc(p.date)}" required>`)}
      ${field('Short summary (optional)', `<input name="excerpt" value="${esc(p.excerpt ?? '')}" maxlength="140">`, 'One line shown in link previews.')}
      ${themePicker(p.theme)}
      <div class="a-f"><span>Cover photo (optional)</span>
        <div class="a-photo">${p.cover ? `<img src="${esc(assetUrl(p.cover))}" alt="">` : '<div class="a-noimg">Uses the cover colour</div>'}<input name="cover" type="file" accept="image/*"></div>
        <small>It is resized automatically.</small></div>
      ${field('Text', `<textarea name="body" rows="14" required>${esc(p.body)}</textarea>`, 'Leave a blank line between paragraphs. Start a line with &gt; for a pull quote, or ## for a heading.')}
      <p class="a-err" role="alert"></p>
      <div class="a-buttons"><button class="btn" type="submit">Save post</button><a class="btn ghost" href="#/journal">Cancel</a>${id ? '<button class="btn ghost danger" type="button" data-del>Delete post</button>' : ''}</div>
    </form>`;
  bar(el, id ? p.title : 'New post');
  const f = $<HTMLFormElement>('form', el);
  const err = (m: string) => { $('.a-err', el).textContent = m; };
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const title = String(d.get('title')).trim(), author = String(d.get('author')).trim(), body = String(d.get('body')).trim();
    if (title.length < 2) return err('Please add a title.');
    if (author.length < 2) return err('Please add the author.');
    if (!String(d.get('date'))) return err('Choose a date.');
    if (body.length < 20) return err('The text is very short. Add a little more.');
    const b = $<HTMLButtonElement>('button[type=submit]', el);
    busy(b, true, 'Saving…');
    try {
      const rec: Post = p.id ? p : { ...p, id: uniqueId(slugify(title), (x) => model.posts.some((m) => m.id === x) || removedPosts.has(x) || repoPosts.has(x)) };
      const file = (f.elements.namedItem('cover') as HTMLInputElement).files?.[0];
      if (file) {
        const img = await photo(file, 1200, 675);
        if (rec.cover) discardFile('public/' + rec.cover, repoPosts.has(rec.id));
        const path = `media/posts/${rec.id}.${img.ext}`;
        files.set('public/' + path, { b64: img.b64 });
        rec.cover = path;
      }
      Object.assign(rec, { title, author, body, category: String(d.get('category')), date: String(d.get('date')), theme: String(d.get('theme') || 'c0'), excerpt: String(d.get('excerpt')).trim() || undefined });
      delete rec.sample;
      if (!p.id) model.posts.push(rec);
      touch({ post: rec.id });
      toast('Saved. Press Publish when you are ready.');
      go('#/journal');
    } catch (x: any) { err(x.message || 'Could not save.'); busy(b, false); }
  });
  $('[data-del]', el)?.addEventListener('click', () => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    if (p.cover) discardFile('public/' + p.cover, true);
    model.posts = model.posts.filter((x) => x !== p);
    model.reviews = model.reviews.filter((r) => r.target !== `post:${p.id}`);
    dirty.posts.delete(p.id);
    if (repoPosts.has(p.id)) removedPosts.add(p.id);
    touch('reviews');
    go('#/journal');
  });
}
