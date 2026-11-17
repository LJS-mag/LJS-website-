import { model, backup } from '../model';
import { ctx } from '../ctx';
import { esc, $, bar, siteUrl, toast } from '../ui';
import { expiryState, setExpiry, checkExpiry, suggestedExpiry, fmtDate } from '../expiry';

/** Shows when the saved token ends, or asks for the date on a device that was set up before the reminder existed. */
function tokenCard(el: HTMLElement) {
  const body = $('#tokbody', el);
  const e = expiryState();
  if (e.state === 'none') {
    body.innerHTML = `<p class="a-help">Your token lets this admin save changes to the website. It stops working on a date GitHub chose when it was made. Tell the admin that date and it will warn you a month before.</p>
      <form class="a-form" novalidate><label class="a-f"><span>The token expires on</span><input name="expiry" type="date" required value="${esc(suggestedExpiry())}"><small>GitHub shows it next to "Expires on" on the token page. If you made the token for one year just now, leave the suggested date.</small></label>
      <p class="a-err" role="alert"></p><div class="a-buttons"><button class="btn" type="submit">Save the date</button></div></form>`;
    const f = $<HTMLFormElement>('form', body);
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = String(new FormData(f).get('expiry') || '');
      const bad = checkExpiry(d);
      if (bad) { $('.a-err', body).textContent = bad; return; }
      setExpiry(d);
      window.dispatchEvent(new Event('ljs-expiry'));
      tokenCard(el);
      toast('Saved. You will get a warning a month before it ends.');
    });
    return;
  }
  const msg = e.state === 'expired' ? `Your token expired on ${fmtDate(e.date!)}.` : `Your token works until ${fmtDate(e.date!)} (${e.days} day${e.days === 1 ? '' : 's'} left).`;
  body.innerHTML = `<p class="a-help" id="tokmsg">${esc(msg)} You get a warning a month before. If you renew it, set this device up again and enter the new date.</p>`;
}

export function render(el: HTMLElement) {
  const sampleIssues = model.issues.filter((i) => i.sample), samplePosts = model.posts.filter((p) => p.sample), sampleReviews = model.reviews.filter((r) => r.sample);
  const s = model.settings;
  const todo: [boolean, string, string][] = [
    [!s.contactEmail, 'Add the society contact email', '#/settings'],
    [!s.formRelayKey, 'Add the form key so applications and reviews reach your inbox', '#/settings'],
    [sampleIssues.length > 0, `Replace ${sampleIssues.length} sample issue${sampleIssues.length === 1 ? '' : 's'} with real ones`, '#/issues'],
    [samplePosts.length > 0, `Replace ${samplePosts.length} sample post${samplePosts.length === 1 ? '' : 's'} (or delete them)`, '#/journal'],
    [model.instagram.some((g) => g.sample), `Replace ${model.instagram.filter((g) => g.sample).length} sample Instagram posts with real ones`, '#/instagram'],
    [sampleReviews.length > 0, `Remove ${sampleReviews.length} sample review${sampleReviews.length === 1 ? '' : 's'}`, '#/reviews'],
  ];
  const open = todo.filter((t) => t[0]);
  el.innerHTML = `
    <div class="a-cards">
      <div class="a-card"><b>${model.issues.length}</b><span>Issues</span></div>
      <div class="a-card"><b>${model.posts.length}</b><span>Journal posts</span></div>
      <div class="a-card"><b>${model.team.length}</b><span>Team members</span></div>
      <div class="a-card"><b>${model.reviews.filter((r) => r.status === 'approved').length}</b><span>Reviews shown</span></div>
    </div>
    <section class="a-card"><h2>Before the site goes public</h2>
      ${open.length ? `<ul class="a-todo">${open.map((t) => `<li><a href="${t[2]}">${esc(t[1])}</a></li>`).join('')}</ul>` : '<p>Everything is filled in. Nice work.</p>'}
    </section>
    <section class="a-card"><h2>The website</h2>
      <p id="build" class="a-help">Checking the latest update…</p>
      <div class="a-buttons"><a class="btn" href="${esc(siteUrl())}" target="_blank" rel="noopener">Open the website</a><button class="btn ghost" id="backup">Download a backup</button></div>
      <p class="a-help">The backup is one file with all your issues, posts, team and reviews. The site itself also keeps every earlier version.</p>
    </section>
    <section class="a-card" id="tokcard"><h2>Admin token</h2><div id="tokbody"></div></section>`;
  bar(el, 'Welcome');
  tokenCard(el);
  $('#backup', el).addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(backup(), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ljs-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded.');
  });
  ctx.gh!.build().then((b) => {
    const msg = { none: 'No update has run yet.', building: 'The website is updating right now.', live: 'The website is up to date.', failed: 'The last update did not work. The site is still showing the previous version.' }[b.state];
    $('#build', el).innerHTML = esc(msg) + (b.url && b.state === 'failed' ? ` <a href="${esc(b.url)}" target="_blank" rel="noopener">See why</a>` : '');
  }).catch(() => ($('#build', el).textContent = 'Could not check the latest update.'));
}
