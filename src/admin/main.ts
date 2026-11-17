import { hasSetup, getRepo, saveSetup, unlock, forgetDevice, type RepoCfg } from './crypto';
import { GitHub } from './github';
import { loadAll, restoreDraft, clearDraft, saveDraft, validate, pendingChanges, changeCount, getHead } from './model';
import { ctx } from './ctx';
import { $, esc, toast, siteUrl } from './ui';
import * as dashboard from './screens/dashboard';
import * as issues from './screens/issues';
import * as posts from './screens/posts';
import * as team from './screens/team';
import * as reviews from './screens/reviews';
import * as settings from './screens/settings';
import * as instagram from './screens/instagram';
import { setExpiry, clearExpiry, expiryState, suggestedExpiry, checkExpiry, fmtDate, markAuthProblem, clearAuthProblem, hasAuthProblem, RENEW_STEPS } from './expiry';

const root = document.getElementById('admin')!;
const logo = siteUrl('media/logo-eggplant.png');
const IDLE_MS = 10 * 60 * 1000;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});

/* ---------- first-time setup on this device ---------- */
function guessRepo() {
  const host = location.hostname;
  if (host.endsWith('.github.io')) return `${host.split('.')[0]}/${location.pathname.split('/')[1] === 'admin' ? '' : location.pathname.split('/')[1]}`;
  return '';
}
function showSetup(msg = '') {
  root.innerHTML = `
    <div class="a-center"><form class="a-lock a-wide" novalidate>
      <img src="${esc(logo)}" width="56" height="56" alt="">
      <h1>Set up this device</h1>
      <p class="a-help">You only do this once per phone or computer. Your token stays on this device, locked with a PIN.</p>
      <details class="a-how"><summary>How do I get a token?</summary><ol>
        <li>Sign in to GitHub, then open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li>
        <li>Name it "Website admin", set the expiry to 1 year, and under "Repository access" choose "Only select repositories", then pick the website repository.</li>
        <li>Under "Repository permissions" set <b>Contents</b> to "Read and write" and <b>Actions</b> to "Read-only". Press Generate and copy the token.</li>
      </ol></details>
      <label class="a-f"><span>Website repository</span><input name="repo" value="${esc(guessRepo())}" placeholder="society-name/website" required autocomplete="off" spellcheck="false"></label>
      <label class="a-f"><span>Token</span><input name="token" type="password" required autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
      <label class="a-f"><span>When does the token expire?</span><input name="expiry" type="date" required value="${esc(suggestedExpiry())}"><small>GitHub shows this date next to "Expires on" on the token page. If you chose one year, the suggested date is right. The admin warns you a month before.</small></label>
      <div class="a-two">
        <label class="a-f"><span>Choose a PIN</span><input name="pin" type="password" inputmode="numeric" minlength="6" required autocomplete="new-password"><small>At least 6 digits.</small></label>
        <label class="a-f"><span>PIN again</span><input name="pin2" type="password" inputmode="numeric" required autocomplete="new-password"></label>
      </div>
      <details class="a-how"><summary>Advanced</summary>
        <label class="a-f"><span>Branch</span><input name="branch" value="main"></label>
        <label class="a-f"><span>GitHub address</span><input name="api" value="https://api.github.com"></label></details>
      <p class="a-err" role="alert">${esc(msg)}</p>
      <button class="btn" type="submit">Connect</button>
      ${hasSetup() ? '<a href="#" class="a-link" id="back">Back to unlock</a>' : ''}
    </form></div>`;
  $('#back')?.addEventListener('click', (e) => { e.preventDefault(); showLock(); });
  const f = $<HTMLFormElement>('form');
  const err = (m: string) => ($('.a-err').textContent = m);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const [owner, name] = String(d.get('repo')).trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
    const token = String(d.get('token')).trim(), pin = String(d.get('pin'));
    if (!owner || !name) return err('Write the repository like: society-name/website');
    if (!token) return err('Paste the token from GitHub.');
    if (!/^\d{6,}$/.test(pin) && pin.length < 8) return err('Use a PIN of at least 6 digits.');
    if (pin !== d.get('pin2')) return err('The two PINs are different.');
    const expiry = String(d.get('expiry') || '');
    const badDate = checkExpiry(expiry);
    if (badDate) return err(badDate);
    const cfg: RepoCfg = { owner, name, branch: String(d.get('branch')).trim() || 'main', api: String(d.get('api')).trim().replace(/\/$/, '') };
    const b = $<HTMLButtonElement>('button[type=submit]');
    b.disabled = true; b.textContent = 'Checking…';
    try {
      await new GitHub(cfg, token).verify();
      await saveSetup(cfg, token, pin);
      setExpiry(expiry);
      clearAuthProblem();
      await start(token);
    } catch (x: any) { err(x.auth ? 'GitHub did not accept that token. Check that you copied all of it, and that it has not expired.' : x.message || 'Could not connect.'); b.disabled = false; b.textContent = 'Connect'; }
  });
}

/* ---------- unlock ---------- */
let fails = 0, lockedUntil = 0;
function showLock(msg = '') {
  ctx.gh = null;
  root.innerHTML = `
    <div class="a-center"><form class="a-lock" novalidate>
      <img src="${esc(logo)}" width="56" height="56" alt="">
      <h1>Website admin</h1>
      <label class="a-f"><span>PIN</span><input name="pin" type="password" inputmode="numeric" autocomplete="current-password" autofocus required></label>
      <p class="a-err" role="alert">${esc(msg)}</p>
      <button class="btn" type="submit">Unlock</button>
      <a href="#" class="a-link" id="forget">Set this device up again</a>
    </form></div>`;
  $('#forget').addEventListener('click', (e) => { e.preventDefault(); if (confirm('This removes the saved token from this device. You will need a new token to connect again.')) { forgetDevice(); clearExpiry(); showSetup(); } });
  const f = $<HTMLFormElement>('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (wait > 0) return ($('.a-err').textContent = `Too many tries. Wait ${wait} seconds.`);
    const token = await unlock(String(new FormData(f).get('pin')));
    if (!token) {
      if (++fails >= 5) { lockedUntil = Date.now() + 30_000; fails = 0; }
      return ($('.a-err').textContent = 'That PIN is not right.');
    }
    fails = 0;
    start(token);
  });
}

/* ---------- signed in ---------- */
async function start(token: string) {
  const cfg = getRepo()!;
  ctx.gh = new GitHub(cfg, token);
  root.innerHTML = '<div class="a-center"><p class="a-help">Loading the website…</p></div>';
  try {
    await loadAll(ctx.gh);
    clearAuthProblem(); // the token works
  } catch (x: any) {
    if (x.auth) markAuthProblem();
    root.innerHTML = `<div class="a-center"><div class="a-lock"><h1>Could not load</h1><p class="a-err">${esc(x.message)}</p><button class="btn" id="retry">Try again</button> <button class="btn ghost" id="lock">Lock</button></div></div>`;
    $('#retry').addEventListener('click', () => start(token));
    $('#lock').addEventListener('click', () => showLock());
    return;
  }
  const r = await restoreDraft();
  shell();
  if (r === 'restored') toast('Your unpublished changes were restored.');
  if (r === 'stale') { await clearDraft(); toast('The website changed since your last session, so the old unpublished changes were dropped.', 'err'); }
  route();
  resetIdle();
}

const SCREENS: Record<string, { render: (el: HTMLElement, arg?: string) => void }> = { home: dashboard, issues, journal: posts, instagram, team, reviews, settings };
const TABS: [string, string][] = [['home', 'Home'], ['issues', 'Issues'], ['journal', 'Journal'], ['instagram', 'Instagram'], ['team', 'Team'], ['reviews', 'Reviews'], ['settings', 'Settings']];

function shell() {
  root.innerHTML = `
    <header class="a-top"><div class="a-topin">
      <a class="a-brand" href="#/"><img src="${esc(logo)}" width="30" height="30" alt=""><span>Admin</span></a>
      <nav id="a-nav" aria-label="Admin">${TABS.map(([k, l]) => `<a href="#/${k === 'home' ? '' : k}" data-k="${k}">${l}</a>`).join('')}</nav>
      <button class="btn ghost" id="a-lock">Lock</button>
    </div></header>
    <main id="a-main" class="a-main"></main>
    <div id="a-pub" class="a-pubbar" hidden>
      <span id="a-count"></span>
      <button class="btn ghost" id="a-discard">Discard changes</button>
      <button class="btn" id="a-publish">Publish</button>
    </div>
    <div id="a-build" class="a-buildbar" hidden></div>
    <div id="a-modal" class="a-modal" hidden></div>`;
  $('header.a-top').insertAdjacentHTML('afterend', '<div id="a-exp" class="a-expbar" role="status" hidden></div>');
  window.addEventListener('ljs-expiry', refreshExpiry);
  refreshExpiry();
  $('#a-lock').addEventListener('click', async () => { await saveDraft(); showLock(); });
  $('#a-publish').addEventListener('click', publish);
  $('#a-discard').addEventListener('click', async () => {
    if (!confirm('Throw away everything you have changed but not published?')) return;
    await clearDraft();
    await loadAll(ctx.gh!);
    route();
    refreshBar();
    toast('Changes discarded.');
  });
  window.addEventListener('ljs-changed', refreshBar);
  refreshBar();
}

/* A banner under the top bar on every screen once the token is close to its end, has ended, or GitHub refused it. */
function refreshExpiry() {
  const el = document.getElementById('a-exp');
  if (!el) return;
  const e = expiryState();
  let cls = '', html = '';
  if (hasAuthProblem()) { cls = 'bad'; html = '<b>GitHub is not accepting the saved token.</b> It has most likely expired or been removed. You cannot publish until you press <b>Lock</b>, choose <b>Set this device up again</b> and paste a new token.'; }
  else if (e.state === 'expired') { cls = 'bad'; html = `<b>Your token expired on ${esc(fmtDate(e.date!))}.</b> You cannot publish until you set this device up again with a new token.`; }
  else if (e.state === 'soon') { cls = 'warn'; html = `<b>Your token expires in ${e.days} day${e.days === 1 ? '' : 's'} (${esc(fmtDate(e.date!))}).</b> Renew it soon, so you are not locked out in the middle of publishing.`; }
  el.hidden = !html;
  el.className = `a-expbar ${cls}`;
  el.innerHTML = html ? `${html}${RENEW_STEPS}` : '';
}

function route() {
  const [area = 'home', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const screen = SCREENS[area] ?? dashboard;
  const main = $('#a-main');
  main.innerHTML = '';
  screen.render(main, arg ? decodeURIComponent(arg) : undefined);
  document.querySelectorAll<HTMLElement>('#a-nav a').forEach((a) => a.classList.toggle('on', a.dataset.k === (SCREENS[area] ? area : 'home')));
  window.scrollTo(0, 0);
  refreshBar();
}
window.addEventListener('hashchange', () => { if (ctx.gh) route(); });

function refreshBar() {
  const bar = document.getElementById('a-pub');
  if (!bar) return;
  const n = changeCount();
  bar.hidden = n === 0;
  $('#a-count').textContent = n ? `You have unpublished changes (${n}).` : '';
}

/* ---------- publish ---------- */
let publishing = false;
async function publish() {
  if (publishing) return;
  const errs = validate();
  if (errs.length) { toast(errs[0] + (errs.length > 1 ? ` (and ${errs.length - 1} more)` : ''), 'err'); return; }
  const changes = pendingChanges();
  if (!changes.length) return;
  const text = changes.filter((c) => !c.del && c.text).length, imgs = changes.filter((c) => !c.del && c.b64).length, dels = changes.filter((c) => c.del).length;
  if (!confirm(`Publish now?\n\n${text} text file${text === 1 ? '' : 's'}, ${imgs} image${imgs === 1 ? '' : 's'}${dels ? `, ${dels} removal${dels === 1 ? '' : 's'}` : ''}.\nThe website updates in about two minutes.`)) return;
  publishing = true;
  const modal = $('#a-modal');
  modal.hidden = false;
  modal.innerHTML = '<div class="a-modalbox"><h2>Publishing…</h2><div class="a-progress"><div></div><span>Starting</span></div></div>';
  const setP = (d: number, t: number) => { ($('.a-progress div', modal) as HTMLElement).style.width = `${(d / t) * 100}%`; $('.a-progress span', modal).textContent = `Uploading ${d} of ${t}`; };
  try {
    const sha = await ctx.gh!.commit(changes, 'Update website content (admin)', getHead(), setP);
    ctx.lastSha = sha;
    modal.hidden = true;
    await clearDraft();
    await loadAll(ctx.gh!);
    route();
    refreshBar();
    toast('Published. The website will update shortly.');
    watchBuild(sha);
  } catch (x: any) {
    modal.hidden = true;
    if (x.auth) markAuthProblem();
    toast(x.message || 'Publishing failed. Your changes are still here.', 'err');
  } finally { publishing = false; }
}

async function watchBuild(sha: string) {
  const b = $('#a-build');
  b.hidden = false;
  const show = (cls: string, html: string) => { b.className = `a-buildbar ${cls}`; b.innerHTML = html; };
  show('wait', 'Waiting for the website to start updating…');
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    if (!ctx.gh) return;
    try {
      const s = await ctx.gh.build(sha);
      if (s.state === 'building') show('wait', 'The website is updating. This takes about two minutes.');
      if (s.state === 'live') { show('ok', 'The website is up to date. <button class="a-x" aria-label="Close">×</button>'); b.querySelector('.a-x')?.addEventListener('click', () => (b.hidden = true)); return; }
      if (s.state === 'failed') { show('bad', `The update did not work, so visitors still see the previous version. ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">See why</a>` : ''}`); return; }
    } catch { /* keep trying */ }
  }
  show('wait', 'Still updating. Check the website in a few minutes.');
}

/* ---------- auto-lock when idle ---------- */
let idle: number | undefined;
function resetIdle() {
  clearTimeout(idle);
  idle = window.setTimeout(async () => { if (ctx.gh) { await saveDraft(); showLock('Locked after 10 minutes without use.'); } }, IDLE_MS);
}
['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, () => ctx.gh && resetIdle(), { passive: true }));

if (hasSetup()) showLock(); else showSetup();
