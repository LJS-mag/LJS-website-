import { model, backup } from '../model';
import { ctx } from '../ctx';
import { esc, $, bar, siteUrl, toast } from '../ui';

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
    </section>`;
  bar(el, 'Welcome');
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
