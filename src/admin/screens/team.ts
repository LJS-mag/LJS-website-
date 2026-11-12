import { model, touch, files, type Team, type Group } from '../model';
import { esc, $, field, slugify, uniqueId, toast, go, bar, assetUrl, discardFile, busy } from '../ui';
import { photo } from '../images';

const GROUPS: [Group, string, number][] = [['leadership', 'Leadership', 1], ['writers', 'Writers', 10], ['designers', 'Designers', 30]];
const initials = (n: string) => { const w = n.trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : n.slice(0, 2)).toUpperCase(); };

export function render(el: HTMLElement, arg?: string) {
  if (arg) return form(el, arg === 'new' ? null : arg);
  el.innerHTML = `<div class="a-sections">${GROUPS.map(([g, label]) => {
    const rows = model.team.filter((t) => t.group === g).sort((a, b) => a.order - b.order);
    return `<section><h2>${label} <small>${rows.length}</small></h2><div class="a-list">${rows.map((t) => `
      <a class="a-row" href="#/team/${esc(t.id)}">
        <span class="a-thumb">${t.photo ? `<img src="${esc(assetUrl('media/team/' + t.photo))}" alt="" loading="lazy">` : esc(initials(t.name))}</span>
        <span class="a-body"><b>${esc(t.name)}</b><small>${esc(t.role)}</small></span><span class="a-go">Edit</span>
      </a>`).join('') || '<p class="a-empty">No one here yet.</p>'}</div></section>`;
  }).join('')}</div>`;
  bar(el, 'Team', '<a class="btn" href="#/team/new">Add a team member</a>');
}

function form(el: HTMLElement, id: string | null) {
  const t: Team = id ? model.team.find((x) => x.id === id)! : { id: '', name: '', role: '', group: 'writers', order: 0 };
  if (id && !t) { el.innerHTML = '<p class="a-empty">That team member was not found.</p>'; return; }
  el.innerHTML = `
    <form class="a-form" novalidate>
      ${field('Name', `<input name="name" value="${esc(t.name)}" required autocomplete="off">`)}
      ${field('Role', `<input name="role" value="${esc(t.role)}" placeholder="Writer, Graphic Designer, Chief Editor…" required>`)}
      ${field('Group', `<select name="group">${GROUPS.map(([g, l]) => `<option value="${g}" ${t.group === g ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('Order in the group', `<input name="order" type="number" min="1" value="${t.order || ''}" placeholder="auto">`, 'Lower numbers come first.')}
      <div class="a-f"><span>Photo</span>
        <div class="a-photo">${t.photo ? `<img src="${esc(assetUrl('media/team/' + t.photo))}" alt="">` : '<div class="a-noimg">No photo</div>'}
        <input name="photo" type="file" accept="image/*"></div>
        <small>Any size. It is cropped to a portrait (4:5) and shrunk automatically.</small></div>
      ${field('Introduction (optional)', `<textarea name="bio" rows="6">${esc(t.bio ?? '')}</textarea>`, 'Shown beside the photo. Leaders usually have one.')}
      <p class="a-err" role="alert"></p>
      <div class="a-buttons"><button class="btn" type="submit">Save</button><a class="btn ghost" href="#/team">Cancel</a>${id ? '<button class="btn ghost danger" type="button" data-del>Remove</button>' : ''}</div>
    </form>`;
  bar(el, id ? t.name : 'New team member');
  const f = $<HTMLFormElement>('form', el);
  const err = (m: string) => { $('.a-err', el).textContent = m; };
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const name = String(d.get('name')).trim(), role = String(d.get('role')).trim();
    if (name.length < 2) return err('Please add a name.');
    if (role.length < 2) return err('Please add a role.');
    const group = String(d.get('group')) as Group;
    const base = GROUPS.find((g) => g[0] === group)![2];
    const inGroup = model.team.filter((x) => x.group === group && x !== t);
    const order = Number(d.get('order')) || Math.max(base - 1, ...inGroup.map((x) => x.order)) + 1;
    const bio = String(d.get('bio')).trim();
    const b = $<HTMLButtonElement>('button[type=submit]', el);
    busy(b, true, 'Saving…');
    try {
      const rec: Team = t.id ? t : { ...t, id: uniqueId(slugify(name), (x) => model.team.some((m) => m.id === x)) };
      const file = (f.elements.namedItem('photo') as HTMLInputElement).files?.[0];
      if (file) {
        const img = await photo(file, 640, 800);
        if (rec.photo) discardFile('public/media/team/' + rec.photo, true);
        files.set(`public/media/team/${rec.id}.${img.ext}`, { b64: img.b64 });
        rec.photo = `${rec.id}.${img.ext}`;
      }
      Object.assign(rec, { name, role, group, order, bio: bio || undefined });
      if (!t.id) model.team.push(rec);
      touch('team');
      toast('Saved. Press Publish when you are ready.');
      go('#/team');
    } catch (x: any) { err(x.message || 'Could not save.'); busy(b, false); }
  });
  $('[data-del]', el)?.addEventListener('click', () => {
    if (!confirm(`Remove ${t.name} from the team?`)) return;
    if (t.photo) discardFile('public/media/team/' + t.photo, true);
    model.team = model.team.filter((x) => x !== t);
    touch('team');
    go('#/team');
  });
}
