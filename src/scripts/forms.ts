/* Review and application forms.
   Nothing is stored on a server: each submission is emailed to the society through a free form relay
   (Web3Forms). The access key in content/settings.json is tied to the society's inbox and can only send mail to it.
   Reviews arrive with a ready-to-paste block; the team approves them in the admin page and publishes. */

const RELAY = 'https://api.web3forms.com/submit';

type FormEl = HTMLFormElement;
const setErr = (f: FormEl, name: string, msg: string) => {
  const el = f.querySelector<HTMLElement>(`[data-e="${name}"]`) ?? f.elements.namedItem(name)?.closest('label')?.querySelector<HTMLElement>('.err');
  if (el) el.textContent = msg;
  return !msg;
};

async function send(f: FormEl, fields: Record<string, string>): Promise<'ok' | 'demo' | 'fail'> {
  if (f.hasAttribute('data-demo')) return 'demo';
  const key = f.dataset.key;
  if (!key) return 'fail';
  try {
    const res = await fetch(RELAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: key, from_name: 'LJS website', botcheck: '', ...fields }),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok && j.success !== false ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const thanks = (f: FormEl, title: string, text: string, demo: boolean) => {
  const box = document.createElement('div');
  box.className = 'ok fade';
  box.innerHTML = `<h2></h2><p style="color:var(--ink-2)"></p>`;
  box.querySelector('h2')!.textContent = title;
  box.querySelector('p')!.textContent = text + (demo ? ' (Dev mode: nothing was sent.)' : '');
  f.replaceWith(box);
};
const busy = (f: FormEl, on: boolean) => {
  const b = f.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  b.disabled = on;
  b.textContent = on ? 'Sending…' : b.dataset.label || b.textContent;
  if (!on) return;
  b.dataset.label = b.dataset.label || 'Submit';
};

/* ---- review ---- */
document.querySelectorAll<FormEl>('form[data-form="review"]').forEach((f) => {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const el = f.elements as any;
    if (el.botcheck?.checked) return; // honeypot: silently drop bots
    const rating = Number(el.rate.value || 0);
    const name = String(el.n.value).trim();
    const text = String(el.t.value).trim();
    let ok = true;
    ok = setErr(f, 'rate', rating ? '' : 'Choose a star rating.') && ok;
    ok = setErr(f, 'n', name ? '' : 'Please add your name.') && ok;
    ok = setErr(f, 't', text.length >= 10 ? '' : 'Write at least 10 characters.') && ok;
    if (!ok) return;

    const target = f.dataset.target!;
    const id = 'r' + Date.now().toString(36);
    const block = JSON.stringify({ id, target, name, rating, text, date: today(), status: 'approved' });
    busy(f, true);
    const r = await send(f, {
      subject: `[LJS review to approve] ${target} · ${rating}/5 · ${name}`,
      name,
      message: `New review for ${target}\n\nName: ${name}\nRating: ${rating}/5\n\n${text}\n\n--- paste this into Admin > Reviews to approve ---\n${block}`,
    });
    busy(f, false);
    if (r === 'fail') {
      const n = f.querySelector<HTMLElement>('[data-note]');
      if (n) n.textContent = 'Sorry, that did not send. Please try again in a moment.';
      return;
    }
    thanks(f, 'Thank you!', 'Your review will appear once the team has read it.', r === 'demo');
  });
});

/* ---- application ---- */
document.querySelectorAll<FormEl>('form[data-form="apply"]').forEach((f) => {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const el = f.elements as any;
    if (el.botcheck?.checked) return;
    const v = (n: string) => String(el[n].value).trim();
    const age = Number(v('age'));
    let ok = true;
    ok = setErr(f, 'name', v('name') ? '' : 'Please fill this in.') && ok;
    ok = setErr(f, 'email', /^\S+@\S+\.\S+$/.test(v('email')) ? '' : 'Enter a valid email.') && ok;
    ok = setErr(f, 'age', age >= 13 && age <= 25 ? '' : 'We accept ages 13 to 25.') && ok;
    ok = setErr(f, 'role', v('role') ? '' : 'Please choose a role.') && ok;
    ok = setErr(f, 'why', v('why') ? '' : 'Please fill this in.') && ok;
    ok = setErr(f, 'consent', el.consent.checked ? '' : 'Please tick the box to continue.') && ok;
    if (!ok) return;

    busy(f, true);
    const r = await send(f, {
      subject: `[LJS application] ${v('name')} · ${v('role')}`,
      name: v('name'),
      email: v('email'),
      message: `Name: ${v('name')}\nEmail: ${v('email')}\nAge: ${age}\nRole: ${v('role')}\nLink: ${v('link') || '-'}\n\nWhy they want to join:\n${v('why')}\n\nConsent to privacy notice: yes`,
    });
    busy(f, false);
    if (r === 'fail') {
      let n = f.querySelector<HTMLElement>('[data-sendfail]');
      if (!n) {
        n = document.createElement('p');
        n.className = 'err';
        n.setAttribute('data-sendfail', '');
        f.appendChild(n);
      }
      n.textContent = 'Sorry, that did not send. Please try again in a moment.';
      return;
    }
    thanks(f, 'Thank you.', 'Your application is in. We will email you soon.', r === 'demo');
  });
});
