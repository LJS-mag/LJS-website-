import { model, touch } from '../model';
import { esc, $, field, toast, bar } from '../ui';

export function render(el: HTMLElement) {
  const s = model.settings;
  const statRow = (v = '', l = '') => `<div class="a-stat"><input name="sv" value="${esc(v)}" placeholder="12" aria-label="Number"><input name="sl" value="${esc(l)}" placeholder="Issues published" aria-label="Label"><button type="button" class="btn ghost danger" data-rm aria-label="Remove">×</button></div>`;
  el.innerHTML = `
    <form class="a-form" novalidate>
      <label class="a-check"><input type="checkbox" name="open" ${s.applicationsOpen ? 'checked' : ''}><span><b>Applications are open</b><br><small>Turn this off to show "Applications closed" on the Apply page.</small></span></label>
      ${field('Contact email', `<input name="email" type="email" value="${esc(s.contactEmail)}" placeholder="society@example.com">`, 'Shown in the footer and on the privacy page.')}
      ${field('Application form link (Google Form, optional)', `<input name="apply" type="url" value="${esc(String(s.applyFormUrl ?? ''))}" placeholder="https://forms.gle/…" autocomplete="off" spellcheck="false">`, 'Paste the link to your Google Form. The Apply page then sends people to it. Leave empty to use the form built into this website (that one needs the form key below).')}
      ${field('Form key (Web3Forms)', `<input name="key" value="${esc(s.formRelayKey)}" autocomplete="off" spellcheck="false">`, 'A free key from web3forms.com, made with the society email. Applications and reviews are sent to that inbox. Without a key, the forms say "open soon".')}
      ${field('Instagram link', `<input name="ig" type="url" value="${esc(s.social.instagram ?? '')}" placeholder="https://www.instagram.com/…">`)}
      ${field('Spotify link (optional)', `<input name="spotify" type="url" value="${esc(s.social.spotify ?? '')}" placeholder="https://open.spotify.com/…" autocomplete="off" spellcheck="false">`, 'Shown in the footer. Open your Spotify profile or playlist, choose Share, then Copy link. Leave empty to hide it.')}
      ${field('Automatic Instagram feed link (optional)', `<input name="feed" value="${esc(String(s.instagramFeed ?? ''))}" placeholder="https://feeds.behold.so/…" autocomplete="off" spellcheck="false">`, 'Paste the feed link from behold.so to show your latest posts on the home page automatically. Leave empty to use the posts you add by hand under Instagram. If the feed ever stops, the hand-added posts are shown instead.')}
      ${field('About the society', `<textarea name="about" rows="5">${esc(s.about)}</textarea>`, 'Shown on the About page.')}
      ${field('About the writers (team page)', `<textarea name="tw" rows="3">${esc(s.teamIntro.writers)}</textarea>`)}
      ${field('About the designers (team page)', `<textarea name="td" rows="3">${esc(s.teamIntro.designers)}</textarea>`)}
      <div class="a-f"><span>Numbers on the About page</span>
        <div id="stats">${s.stats.map((x) => statRow(x.value, x.label)).join('')}</div>
        <button type="button" class="btn ghost" id="addstat">Add a number</button>
        <small>Only add real numbers, like "4" and "Issues published". Leave empty to hide the row. You can write 10k or 100+.</small></div>
      <p class="a-err" role="alert"></p>
      <div class="a-buttons"><button class="btn" type="submit">Save settings</button></div>
    </form>`;
  bar(el, 'Settings');
  const f = $<HTMLFormElement>('form', el);
  $('#addstat', el).addEventListener('click', () => $('#stats', el).insertAdjacentHTML('beforeend', statRow()));
  el.addEventListener('click', (e) => { (e.target as HTMLElement).closest('[data-rm]')?.parentElement?.remove(); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const email = String(d.get('email')).trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { $('.a-err', el).textContent = 'That email does not look right.'; return; }
    const apply = String(d.get('apply')).trim();
    if (apply && !/^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)\S+$/.test(apply)) { $('.a-err', el).textContent = 'That does not look like a Google Form link. It should start with https://forms.gle/ or https://docs.google.com/forms/. Copy it from the Send button in Google Forms.'; return; }
    // keep only the address itself: the ?si=... and utm_... parts only say where a link was shared from
    const spotifyRaw = String(d.get('spotify')).trim();
    if (spotifyRaw && !/^https:\/\/open\.spotify\.com\/\S+$/.test(spotifyRaw)) { $('.a-err', el).textContent = 'That does not look like a Spotify link. It should start with https://open.spotify.com/. Use Share, then Copy link in Spotify.'; return; }
    const spotify = spotifyRaw.replace(/[?#].*$/, '');
    const feed = String(d.get('feed')).trim();
    if (feed && !/^https:\/\/feeds\.behold\.so\/[\w-]+$/.test(feed)) { $('.a-err', el).textContent = 'The feed link should look like https://feeds.behold.so/ followed by letters and numbers. Copy it from your Behold dashboard.'; return; }
    const sv = d.getAll('sv').map(String), sl = d.getAll('sl').map(String);
    const stats = sv.map((v, i) => ({ value: v.trim(), label: sl[i].trim() })).filter((x) => x.value || x.label);
    if (stats.some((x) => !x.value || !x.label)) { $('.a-err', el).textContent = 'Each number needs both the number and its label.'; return; }
    Object.assign(s, {
      applicationsOpen: !!d.get('open'), contactEmail: email, formRelayKey: String(d.get('key')).trim(),
      social: { ...s.social, instagram: String(d.get('ig')).trim() || undefined, spotify: spotify || undefined }, instagramFeed: feed, applyFormUrl: apply,
      about: String(d.get('about')).trim(), teamIntro: { writers: String(d.get('tw')).trim(), designers: String(d.get('td')).trim() }, stats,
    });
    $('.a-err', el).textContent = '';
    touch('settings');
    toast('Saved. Press Publish when you are ready.');
  });
}
