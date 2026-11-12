import { model, touch, type Review } from '../model';
import { esc, $, $$, toast, bar, badge, today } from '../ui';

/* Visitors' reviews arrive by email with a ready-to-paste block. Paste it here, check it, press Approve. */

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
const exists = (t: string) => { const [k, id] = t.split(':'); return k === 'issue' ? model.issues.some((i) => i.id === id) : model.posts.some((p) => p.id === id); };
const label = (t: string) => { const [k, id] = t.split(':'); const x: any = k === 'issue' ? model.issues.find((i) => i.id === id) : model.posts.find((p) => p.id === id); return x ? `${k === 'issue' ? 'Issue ' + x.number + ': ' : ''}${x.title}` : t + ' (not found)'; };

function parseBlock(raw: string): Review | string {
  const a = raw.indexOf('{'), z = raw.lastIndexOf('}');
  if (a < 0 || z < a) return 'I could not find a review block. Paste the whole block from the email, starting with {.';
  let j: any;
  try { j = JSON.parse(raw.slice(a, z + 1)); } catch { return 'That block looks cut off. Copy it again from the email, from { to }.'; }
  if (!/^(issue|post):[a-z0-9-]+$/.test(j.target ?? '')) return 'The review does not say which issue or post it is for.';
  const rating = Number(j.rating), text = String(j.text ?? '').trim(), name = String(j.name ?? '').trim();
  if (!(rating >= 1 && rating <= 5)) return 'The rating is missing or not between 1 and 5.';
  if (text.length < 10 || text.length > 600) return 'The review text should be 10 to 600 characters.';
  if (!name) return 'The review has no name.';
  return { id: String(j.id || 'r' + Date.now().toString(36)), target: j.target, name: name.slice(0, 40), rating, text, date: /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : today(), status: 'approved' };
}

export function render(el: HTMLElement) {
  const draw = () => {
    const groups = new Map<string, Review[]>();
    for (const r of model.reviews) groups.set(r.target, [...(groups.get(r.target) ?? []), r]);
    $('#rv-list', el).innerHTML = [...groups].map(([t, rs]) => `
      <section><h2>${esc(label(t))} <small>${rs.length}</small></h2><div class="a-list">${rs.map((r) => `
        <div class="a-row a-review ${r.status === 'hidden' ? 'is-hidden' : ''}">
          <span class="a-body"><b>${esc(r.name)} <span class="a-stars">${stars(r.rating)}</span></b><small>${esc(r.date)}</small><span class="a-text">${esc(r.text)}</span></span>
          ${r.sample ? badge('Sample') : ''}${r.status === 'hidden' ? badge('Hidden') : ''}
          <span class="a-rowbtns"><button class="btn ghost" data-toggle="${esc(r.id)}">${r.status === 'hidden' ? 'Show' : 'Hide'}</button><button class="btn ghost danger" data-del="${esc(r.id)}">Delete</button></span>
        </div>`).join('')}</div></section>`).join('') || '<p class="a-empty">No reviews yet.</p>';
  };
  el.innerHTML = `
    <section class="a-card"><h2>Approve a new review</h2>
      <p class="a-help">When someone leaves a review, the society gets an email. Copy the block under "paste this into Admin &gt; Reviews" and paste it here.</p>
      <textarea id="rv-paste" rows="5" placeholder='{"id":"…","target":"issue:issue-04", …}'></textarea>
      <div class="a-buttons"><button class="btn" id="rv-read">Check it</button></div>
      <div id="rv-preview"></div>
    </section>
    <div id="rv-list"></div>`;
  bar(el, 'Reviews');
  draw();

  $('#rv-read', el).addEventListener('click', () => {
    const r = parseBlock($<HTMLTextAreaElement>('#rv-paste', el).value);
    const box = $('#rv-preview', el);
    if (typeof r === 'string') { box.innerHTML = `<p class="a-err" role="alert">${esc(r)}</p>`; return; }
    const dup = model.reviews.some((x) => x.id === r.id);
    box.innerHTML = `
      <div class="a-preview"><b>${esc(r.name)}</b> <span class="a-stars">${stars(r.rating)}</span><small>for ${esc(label(r.target))}</small><p>${esc(r.text)}</p>
      ${!exists(r.target) ? '<p class="a-err">That issue or post is not on the site, so it cannot be approved.</p>' : dup ? '<p class="a-err">This review is already approved.</p>' : '<button class="btn" id="rv-ok">Approve and add</button>'}</div>`;
    $('#rv-ok', box)?.addEventListener('click', () => {
      model.reviews.push(r);
      touch('reviews');
      $<HTMLTextAreaElement>('#rv-paste', el).value = '';
      box.innerHTML = '';
      toast('Approved. Press Publish to show it on the site.');
      draw();
    });
  });

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-toggle],button[data-del]');
    if (!b) return;
    const r = model.reviews.find((x) => x.id === (b.dataset.toggle || b.dataset.del));
    if (!r) return;
    if (b.dataset.toggle) r.status = r.status === 'hidden' ? 'approved' : 'hidden';
    else { if (!confirm(`Delete the review by ${r.name}?`)) return; model.reviews = model.reviews.filter((x) => x !== r); }
    touch('reviews');
    draw();
  });
}
