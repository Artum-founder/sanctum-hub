(() => {
'use strict';
const SH = window.SanctumShared;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const has = SH.has;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => matchMedia('(max-width: 959px)').matches;
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';

let CFG = { contactName: 'Peder', contactEmail: 'peder@artum.no' };
let account = null;
let status = 'draft';
let submittedAt = null;
let pendingLocal = null;

/* ---------- icons ---------- */
const I = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  skip: '<path d="M5 6l7 6-7 6M13 6l7 6-7 6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6 12h12"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  camera: '<path d="M4 8.5h3l2-3h6l2 3h3V19H4z"/><circle cx="12" cy="13" r="3.5"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  spark: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  xr: '<path d="M2.5 9.5h19v5a3 3 0 0 1-3 3h-3.2l-2-2.6h-2.6l-2 2.6H5.5a3 3 0 0 1-3-3z"/><path d="M2.5 9.5l2-3h15l2 3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6a5 5 0 0 1 5.5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V19"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>'
};
const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const markSVG = () => `<svg class="step-mark" viewBox="0 0 220 160" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="82" cy="80" r="60"><animate attributeName="cx" values="82;92;82" dur="9s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/></circle><circle cx="138" cy="80" r="60"><animate attributeName="cx" values="138;128;138" dur="9s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/></circle><circle cx="110" cy="80" r="76" stroke-dasharray="1.5 8" stroke-linecap="round" opacity=".7"/></g></svg>`;
const MARK_SMALL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="1" opacity=".3"/><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/><circle cx="20" cy="20" r="6" fill="currentColor" opacity=".8"/><g fill="currentColor" opacity=".6"><path d="M20 2Q25 10 20 14Q15 10 20 2"/><path d="M38 20Q30 25 26 20Q30 15 38 20"/><path d="M20 38Q15 30 20 26Q25 30 20 38"/><path d="M2 20Q10 15 14 20Q10 25 2 20"/></g></svg>';

/* ---------- answers ---------- */
const blankOffer = () => ({ name: '', format: '', mode: '', length: '', price: '', desc: '' });
const blankPlace = () => ({ where: '', when: '' });
const blank = () => ({
  name: '', practiceName: '', title: '', location: '', languages: [], about: '',
  traditions: [], lineage: '', years: '', training: '', philosophy: '',
  audiences: [], offers: [blankOffer()],
  base: '', places: [blankPlace()], travel: '', collab: '',
  modules: [], learning: '', learningIdeas: '', clientTools: [], payment: [],
  booking: [], instagram: '', publicEmail: '', phone: '', showContact: true,
  siteStatus: '', siteUrl: '', siteWish: [], notes: ''
});
const ARR_KEYS = ['languages', 'traditions', 'audiences', 'modules', 'clientTools', 'payment', 'booking', 'siteWish'];
function adoptAnswers(a) {
  const s = Object.assign(blank(), a && typeof a === 'object' ? a : {});
  ARR_KEYS.forEach(k => { s[k] = Array.isArray(s[k]) ? s[k].filter(v => typeof v === 'string') : []; });
  s.offers = Array.isArray(s.offers) && s.offers.length ? s.offers.map(o => Object.assign(blankOffer(), o)) : [blankOffer()];
  s.places = Array.isArray(s.places) && s.places.length ? s.places.map(p => Object.assign(blankPlace(), p)) : [blankPlace()];
  if (typeof s.showContact !== 'boolean') s.showContact = true;
  return s;
}

let state = blank(), photo = null, step = 0, zone = 'head', photoPop = false;
const getP = k => k.split('.').reduce((o, p) => (o == null ? o : o[p]), state);
function setP(k, v) { const p = k.split('.'); let o = state; for (let i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }
const fid = k => 'f-' + k.replace(/\./g, '-');

/* ---------- api ---------- */
async function api(method, url, body, opt = {}) {
  const headers = { 'X-Sanctum': '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin', keepalive: !!opt.keepalive, cache: 'no-store' });
  } catch (e) {
    const err = new Error('Fikk ikke kontakt. Sjekk nettet og prøv igjen.');
    err.status = 0;
    throw err;
  }
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) {
    const err = new Error((data && data.error) || 'Noe gikk galt. Prøv igjen.');
    err.status = r.status;
    err.data = data || {};
    throw err;
  }
  return data || {};
}

/* ---------- saving ---------- */
let dirty = false, inflight = null, saveT = null, retryT = null;
function setSave(s) {
  const el = $('#save');
  if (!el) return;
  el.dataset.s = s;
  if (s === 'saved') el.innerHTML = `${icon('check')}<span>Lagret</span>`;
  else if (s === 'pending') el.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Lagrer</span>';
  else if (s === 'error') el.innerHTML = `${icon('warn')}<span>Ikke lagret ennå</span>`;
  else el.innerHTML = '';
}
function queueSave() {
  if (!account) return;
  dirty = true;
  setSave('pending');
  clearTimeout(saveT);
  saveT = setTimeout(() => flush(), 700);
}
async function flush(opts = {}) {
  clearTimeout(saveT);
  if (!account) return;
  if (inflight && !opts.keepalive) { try { await inflight; } catch (e) { /* handled below */ } }
  if (!dirty) return;
  dirty = false;
  const payload = { answers: state, step };
  const p = api('PUT', '/api/profile', payload, { keepalive: !!opts.keepalive })
    .then(() => { if (!dirty) setSave('saved'); })
    .catch(err => {
      dirty = true;
      if (err.status === 401) { sessionLost(); return; }
      setSave('error');
      clearTimeout(retryT);
      retryT = setTimeout(() => flush(), 4000);
    })
    .finally(() => { if (inflight === p) inflight = null; });
  inflight = p;
  return p;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) flush({ keepalive: true }); });
window.addEventListener('pagehide', () => { if (dirty) flush({ keepalive: true }); });

/* ---------- field builders ---------- */
const VIS = { pub: ['eye', 'Vises på huben'], opt: ['eye', 'Vises hvis du vil'], cli: ['key', 'Bare for klientene dine'], priv: ['lock', 'Bare til oppsettet'] };
const tag = v => (v ? `<span class="vis vis-${v}">${icon(VIS[v][0])}${VIS[v][1]}</span>` : '');

function text(o) {
  const id = fid(o.k), v = getP(o.k) == null ? '' : getP(o.k);
  const desc = o.hint ? ` aria-describedby="${id}-h"` : '';
  const hint = o.hint ? `<p class="hint" id="${id}-h">${o.hint}</p>` : '';
  const ctl = o.area
    ? `<textarea id="${id}" data-k="${o.k}" rows="${o.rows || 3}" maxlength="${o.max || 3000}" placeholder="${esc(o.ph || '')}"${desc}>${esc(v)}</textarea>`
    : `<input id="${id}" data-k="${o.k}" type="${o.type || 'text'}"${o.mode ? ` inputmode="${o.mode}"` : ''} autocomplete="${o.ac || 'off'}" maxlength="${o.max || 200}" value="${esc(v)}" placeholder="${esc(o.ph || '')}"${desc}>`;
  const sugg = o.sugg ? `<div class="sugg"><span class="sugg-l">Forslag:</span>${o.sugg.map(s => `<button type="button" class="chip sm" data-fill="${o.k}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';
  const st = o.starters ? `<div class="sugg"><span class="sugg-l">Trenger du en start?</span>${o.starters.map(s => `<button type="button" class="chip sm ghost" data-start="${o.k}" data-v="${esc(s)}">${esc(s.trim())}…</button>`).join('')}</div>` : '';
  return `<div class="field"${o.zone ? ` data-zone="${o.zone}"` : ''}><div class="f-top"><label for="${id}">${o.label}</label>${tag(o.vis)}</div>${hint}${ctl}${sugg}${st}</div>`;
}

const chipBtn = (k, v, multi, on, own) => `<button type="button" class="chip${own ? ' own' : ''}" data-chip="${k}" data-v="${esc(v)}" data-multi="${multi ? 1 : 0}" aria-pressed="${on}">${icon('check', 'ck')}${esc(v)}</button>`;
function chips(o) {
  const id = fid(o.k) + '-l', cur = getP(o.k);
  const on = v => (o.multi ? (cur || []).includes(v) : cur === v);
  const extra = o.multi && o.custom ? (cur || []).filter(v => !o.opts.includes(v)) : [];
  const own = o.custom ? `<div class="add-own"><label class="sr" for="${fid(o.k)}-own">${esc(o.customPh || 'Skriv din egen')}</label><input type="text" id="${fid(o.k)}-own" data-own="${o.k}" maxlength="60" autocomplete="off" placeholder="${esc(o.customPh || 'Skriv din egen')}"><button type="button" class="btn-sec btn-sm" data-own-add="${o.k}">${icon('plus')}Legg til</button></div>` : '';
  return `<div class="field"${o.zone ? ` data-zone="${o.zone}"` : ''}><div class="f-top"><span class="lbl" id="${id}">${o.label}</span>${tag(o.vis)}</div>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<div class="chips" role="group" aria-labelledby="${id}">${o.opts.map(v => chipBtn(o.k, v, o.multi, on(v), false)).join('')}${extra.map(v => chipBtn(o.k, v, true, true, true)).join('')}</div>${own}${o.after || ''}</div>`;
}

function offersHTML(newIdx) {
  return state.offers.map((o, i) => `<fieldset class="item${i === newIdx ? ' new' : ''}"><legend>Tilbud ${i + 1}</legend>
    ${text({ k: `offers.${i}.name`, label: 'Navn på tilbudet', ph: 'F.eks. Coaching for kvinner', vis: 'pub' })}
    ${chips({ k: `offers.${i}.format`, label: 'Form', opts: ['1:1', 'Par', 'Gruppe', 'Workshop', 'Kurs', 'Retreat', 'Online forløp'], vis: 'pub' })}
    ${chips({ k: `offers.${i}.mode`, label: 'Hvor', opts: ['Fysisk', 'Online', 'Begge deler'], vis: 'pub' })}
    <div class="row2">${text({ k: `offers.${i}.length`, label: 'Varighet', ph: 'F.eks. 90 min', vis: 'pub', max: 60 })}${text({ k: `offers.${i}.price`, label: 'Pris', ph: 'Valgfritt', vis: 'opt', max: 60 })}</div>
    ${text({ k: `offers.${i}.desc`, label: 'Kort beskrivelse', area: true, rows: 2, ph: 'Hva skjer, og hvem passer det for?', vis: 'pub', max: 1500 })}
    ${state.offers.length > 1 ? `<button type="button" class="link-btn" data-remove="offers" data-i="${i}">Fjern tilbud ${i + 1}</button>` : ''}
  </fieldset>`).join('') + (state.offers.length < 8 ? `<button type="button" class="btn-add" data-add="offers">${icon('plus')}Legg til et tilbud</button>` : '');
}
function placesHTML(newIdx) {
  return state.places.map((p, i) => `<div class="place${i === newIdx ? ' item new' : ''}">
    ${text({ k: `places.${i}.where`, label: 'Hva og hvor', ph: 'F.eks. sommerfestival, retreat i Spania' })}
    ${text({ k: `places.${i}.when`, label: 'Når', ph: 'F.eks. juli 2027', max: 80 })}
    ${state.places.length > 1 ? `<button type="button" class="link-btn" data-remove="places" data-i="${i}">Fjern</button>` : ''}
  </div>`).join('') + (state.places.length < 10 ? `<button type="button" class="btn-add" data-add="places">${icon('plus')}Legg til et sted</button>` : '');
}

/* ---------- the questions ---------- */
const TRADITIONS = ['Klassisk tantra', 'Neo-tantra', 'Tantra-yoga', 'Kashmir-shaivisme', 'Tibetansk tantra', 'Taoistisk praksis', 'Kundalini', 'Tantramassasje', 'Bevisst berøring', 'Somatisk sexologi', 'Sexological bodywork', 'Pust og energi', 'Shakti og feminin praksis', 'Maskulin praksis', 'Intimitet i par', 'Ritualer og seremoni', 'Meditasjon', 'Traumebevisst arbeid'];
const MODULES = ['Profil og tilbud', 'Booking av timer', 'Kalender og arrangementer', 'Kurs og læringsmoduler', 'Videoer og lydfiler', 'Øvelser for klientene', 'Journal for klientene', 'Meldinger med klientene', 'Eget fellesskap for klientene', 'Medlemskap', 'Nettbutikk', 'Nyhetsbrev', 'Artikler og blogg'];
const MOD_ICON = { 'Profil og tilbud': 'user', 'Booking av timer': 'calendar', 'Kalender og arrangementer': 'calendar', 'Kurs og læringsmoduler': 'book', 'Videoer og lydfiler': 'play', 'Øvelser for klientene': 'spark', 'Journal for klientene': 'pen', 'Meldinger med klientene': 'chat', 'Eget fellesskap for klientene': 'users', 'Medlemskap': 'key', 'Nettbutikk': 'bag', 'Nyhetsbrev': 'mail', 'Artikler og blogg': 'pen' };

const STEPS = [
  { label: 'Deg', c: 'sage', zone: 'head', title: 'Hvem er du?',
    why: 'Dette blir toppen av huben din, det første folk ser når de finner deg.',
    body: () => `
      <div class="field" data-zone="head"><div class="f-top"><span class="lbl">Et bilde av deg</span>${tag('pub')}</div>
        <p class="hint">Valgfritt. Bildet lagres sammen med svarene dine.</p>
        <div class="photo-row"><div class="photo-thumb">${photo ? `<img src="${photo}" alt="Bildet du har valgt">` : icon('camera')}</div>
          <label class="btn-sec" for="f-photo">${photo ? 'Bytt bilde' : 'Velg et bilde'}</label><input id="f-photo" type="file" accept="image/*" class="sr">
          ${photo ? '<button type="button" class="link-btn" data-photo-clear>Fjern bildet</button>' : ''}</div>
        <p class="form-err" id="photoErr" role="alert"></p></div>
      ${text({ k: 'name', label: 'Navnet du vil bli kjent som', ph: 'Fornavn, eller fullt navn', vis: 'pub', zone: 'head', ac: 'name', max: 80 })}
      ${text({ k: 'practiceName', label: 'Navn på det du driver med', hint: 'Navnet på praksisen eller virksomheten din, hvis du har et. Hopp over hvis du bruker ditt eget navn.', ph: 'F.eks. Kilde Tantra', vis: 'pub', zone: 'head', max: 80 })}
      ${text({ k: 'title', label: 'Hva kaller du deg?', hint: 'Én linje holder. Trykk på et forslag hvis et passer.', ph: 'F.eks. tantrisk sex-coach', vis: 'pub', zone: 'head', max: 100, sugg: ['Tantrisk coach', 'Sex-coach', 'Tantramassør', 'Intimitetscoach', 'Pusteinstruktør', 'Kroppsterapeut', 'Retreat-leder'] })}
      ${text({ k: 'location', label: 'Hvor holder du til?', ph: 'By eller område', vis: 'pub', zone: 'head', max: 100 })}
      ${chips({ k: 'languages', label: 'Språk du jobber på', multi: true, custom: true, customPh: 'Annet språk', opts: ['Norsk', 'Engelsk', 'Svensk', 'Dansk', 'Tysk', 'Spansk'], vis: 'pub', zone: 'head' })}
      ${text({ k: 'about', label: 'Kort om deg', hint: 'To eller tre setninger. Skriv som du ville sagt det til noen du nettopp møtte.', area: true, rows: 4, vis: 'pub', zone: 'about', starters: ['Jeg hjelper ', 'Min vei inn i tantra startet ', 'Det jeg ønsker for dem jeg jobber med, er '] })}` },
  { label: 'Linje', c: 'gold', zone: 'journey', title: 'Linjen din',
    why: 'Tantra rommer mange tradisjoner. Det du velger her, hjelper folk å finne formen som passer dem, og gjør at du blir funnet i riktige sammenhenger.',
    body: () => `
      ${chips({ k: 'traditions', label: 'Hvilke tradisjoner og former jobber du med?', hint: 'Velg så mange du vil. Finner du ikke din, skriv den inn under.', multi: true, custom: true, customPh: 'Skriv din egen', opts: TRADITIONS, vis: 'pub', zone: 'journey' })}
      ${text({ k: 'lineage', label: 'Lærere, skoler og linjer du står i', hint: 'Navn på lærere, skoler eller linjer du har lært av. Stikkord er nok.', area: true, rows: 3, ph: 'F.eks. lærere, retreats, skoler', vis: 'pub', zone: 'journey' })}
      ${chips({ k: 'years', label: 'Hvor lenge har du utforsket dette?', opts: ['Under 2 år', '2 til 5 år', '5 til 10 år', 'Over 10 år'], vis: 'pub', zone: 'journey' })}
      ${text({ k: 'training', label: 'Utdanning, kurs og sertifiseringer', hint: 'Det er helt greit om noe ikke er fullført ennå.', area: true, rows: 3, ph: 'F.eks. coachingstudium, sertifisering, fordypning', vis: 'pub', zone: 'journey' })}
      ${text({ k: 'philosophy', label: 'Med egne ord', hint: 'Valgfritt. Én setning om det som bærer arbeidet ditt. Den vises som et sitat på huben.', ph: 'F.eks. Filosofien er gammel, øvelsene er laget for vår tid.', vis: 'pub', zone: 'about', max: 240 })}` },
  { label: 'Tilbud', c: 'rose', zone: 'offers', title: 'Hva tilbyr du?',
    why: 'Hvert tilbud blir et eget kort på huben, som folk kan lese og ta kontakt fra.',
    body: n => `
      ${chips({ k: 'audiences', label: 'Hvem jobber du med?', hint: 'Velg alle som passer, også dem du har lyst til å begynne med.', multi: true, custom: true, customPh: 'Andre', opts: ['Kvinner', 'Menn', 'Par', 'Grupper', 'Alle kjønn', 'Skeive', 'Nybegynnere', 'Erfarne'], vis: 'pub', zone: 'offers' })}
      <div class="items" data-zone="offers">${offersHTML(n && n.k === 'offers' ? n.i : -1)}</div>` },
  { label: 'Hvor og når', c: 'copper', zone: 'where', title: 'Hvor finner folk deg?',
    why: 'Folk ser hvor du holder til og hvor du skal være. Andre i nettverket kan invitere deg med når de lager noe, for eksempel på en festival.',
    body: n => `
      ${text({ k: 'base', label: 'Hvor tar du imot folk?', ph: 'F.eks. eget rom i Oslo, hjemmebesøk eller online', vis: 'pub', zone: 'where' })}
      <div class="group" data-zone="where"><div class="field"><div class="f-top"><span class="lbl">Steder du skal være fremover</span>${tag('pub')}</div><p class="hint">Festivaler, retreats eller reiser. Valgfritt, og lett å legge til senere.</p></div>${placesHTML(n && n.k === 'places' ? n.i : -1)}</div>
      ${chips({ k: 'travel', label: 'Reiser du for å holde noe?', opts: ['Ja, gjerne', 'Av og til', 'Nei'], vis: 'pub', zone: 'where' })}
      ${chips({ k: 'collab', label: 'Er du åpen for å samarbeide med andre i nettverket?', hint: 'For eksempel å holde noe sammen med andre på en festival.', opts: ['Ja, gjerne', 'Kanskje', 'Ikke nå'], vis: 'pub', zone: 'head' })}` },
  { label: 'Huben din', c: 'forest', zone: 'modules', title: 'Hva skal huben din kunne?',
    why: 'Huben kan vokse med deg. Det du velger her, bestemmer hva som bygges først og hva som kan komme senere.',
    body: () => `
      ${chips({ k: 'modules', label: 'Hva vil du ha på huben?', hint: 'Velg alt som høres nyttig ut. Mangler noe, skriv det inn under.', multi: true, custom: true, customPh: 'Noe annet du ønsker deg', opts: MODULES, vis: 'priv', zone: 'modules' })}
      ${chips({ k: 'learning', label: 'Har du kurs eller læringsinnhold i dag?', opts: ['Ja, ferdig innhold', 'Noe, men det må ordnes', 'Nei, men jeg vil lage', 'Ikke aktuelt'], vis: 'priv', zone: 'modules' })}
      ${text({ k: 'learningIdeas', label: 'Kurs eller forløp du ser for deg', hint: 'Valgfritt. Tema, lengde og form, med dine egne ord.', area: true, rows: 3, ph: 'F.eks. et forløp på åtte uker om pust og nytelse, med en video og en øvelse hver uke', vis: 'priv', zone: 'modules' })}
      ${chips({ k: 'clientTools', label: 'Hva ville hjulpet klientene dine mellom øktene?', hint: 'Klientene bestemmer selv hva de deler. Det de skriver, ser bare du, med mindre de velger noe annet.', multi: true, opts: ['Øvelser og lydfiler', 'Journal mellom øktene', 'Meldinger med deg', 'Booking og påminnelser', 'Ressurser og lesestoff', 'Følge egen utvikling', 'Dele med partner'], vis: 'cli', zone: 'clients' })}
      ${chips({ k: 'payment', label: 'Hvordan vil du ta betalt?', multi: true, opts: ['Per økt', 'Klippekort og pakker', 'Medlemskap', 'Kurs med fast pris', 'Gratis innhold i tillegg', 'Vet ikke ennå'], vis: 'priv', zone: 'modules' })}` },
  { label: 'Til slutt', c: 'dawn', zone: 'contact', title: 'Kontakt og hjemmeside',
    why: 'Her bestemmer du hvordan folk når deg, og om huben skal være hjemmesiden din.',
    body: () => `
      ${chips({ k: 'booking', label: 'Hvordan tar folk kontakt med deg i dag?', multi: true, opts: ['Melding eller telefon', 'E-post', 'Instagram', 'Bookingsystem', 'Mest muntlig'], vis: 'priv', zone: 'contact' })}
      <div class="group" data-zone="contact">
        ${text({ k: 'instagram', label: 'Instagram', ph: '@brukernavn', vis: 'opt', max: 80 })}
        ${text({ k: 'publicEmail', label: 'E-post på huben', hint: 'Kan være en annen enn den du logger inn med.', type: 'email', mode: 'email', ac: 'email', ph: 'navn@eksempel.no', vis: 'opt', max: 254 })}
        ${text({ k: 'phone', label: 'Telefon', type: 'tel', mode: 'tel', ac: 'tel', ph: 'Valgfritt', vis: 'opt', max: 40 })}
        <label class="switch" for="f-showContact"><input type="checkbox" id="f-showContact" data-k="showContact"${state.showContact ? ' checked' : ''}><span class="track" aria-hidden="true"></span><span>Vis kontaktinfo på huben</span></label>
      </div>
      ${chips({ k: 'siteStatus', label: 'Har du en hjemmeside i dag?', opts: ['Nei', 'Holder på med en', 'Ja'], vis: 'priv', zone: 'contact' })}
      ${text({ k: 'siteUrl', label: 'Adressen, hvis du har en', ph: 'dittnavn.no', mode: 'url', vis: 'opt', zone: 'contact', max: 200 })}
      ${chips({ k: 'siteWish', label: 'Hva høres interessant ut?', hint: 'Ingen forpliktelse, det hjelper bare å vite hva du tenker.', multi: true, opts: ['Huben som hjemmeside', 'Eget domene som peker til huben', 'Egen nettside i tillegg', 'Vet ikke ennå'], vis: 'priv', zone: 'contact', after: '<a href="#hjemmeside" class="hint">Les om valgene nederst på siden</a>' })}
      ${text({ k: 'notes', label: 'Noe mer du vil si?', hint: 'Ønsker, spørsmål, ting du er usikker på. Alt er velkomment.', area: true, rows: 3, vis: 'priv' })}
      <div class="send" id="sendBox">
        <h3>Klar til å sende inn?</h3>
        <p id="sendLead"></p>
        <p class="sent-note" id="sentNote" hidden>${icon('check')}<span></span></p>
        <div class="row"><button type="button" class="btn-pri" id="submitBtn">${icon('send')}<span>Send inn</span></button></div>
        <p class="copy-msg" id="sendMsg" role="status" aria-live="polite"></p>
        <details id="rawWrap"><summary>Vis svarene som tekst</summary>
          <div class="row" style="margin-top:8px"><button type="button" class="btn-sec" id="copyBtn">${icon('copy')}Kopier teksten</button></div>
          <textarea id="raw" readonly rows="10" aria-label="Svarene dine som tekst"></textarea></details>
      </div>
      <div class="danger" id="delBox">
        <h3>Slett profilen din</h3>
        <p>Alt du har skrevet slettes med en gang, også bildet. Det kan ikke angres.</p>
        <div class="row" id="delAsk"><button type="button" class="btn-sec" data-del="ask">${icon('trash')}Slett profilen min</button></div>
        <div class="confirm" id="delConfirm" hidden><p><strong>Er du sikker?</strong> Profilen og alle svarene forsvinner for godt.</p>
          <div class="row"><button type="button" class="btn-danger" data-del="yes">${icon('trash')}Ja, slett alt</button><button type="button" class="btn-sec" data-del="no">Avbryt</button></div></div>
        <p class="copy-msg warn" id="delMsg" role="alert"></p>
      </div>` }
];

/* ---------- progress ---------- */
const doneBefore = [];
function buildProgress() {
  $('#prog').innerHTML = STEPS.map((S, i) => `<li><button type="button" class="ps" data-c="${S.c}" data-go="${i}"><span class="bar6"></span><span class="sl"><span class="sl-ck">${icon('check')}</span>${S.label}</span></button></li>`).join('');
  doneBefore.length = 0;
}
function updateProgress() {
  const started = SH.stepsStarted(state);
  $$('.ps').forEach((b, i) => {
    const d = started[i];
    b.classList.toggle('cur', i === step);
    b.classList.toggle('done', d);
    if (i === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.setAttribute('aria-label', `Steg ${i + 1}: ${STEPS[i].label}${d ? ', påbegynt' : ''}`);
    if (d && doneBefore[i] === false && !reduce) { b.classList.remove('bloom'); void b.offsetWidth; b.classList.add('bloom'); }
    doneBefore[i] = d;
  });
}

/* ---------- step rendering ---------- */
function renderStep(o = {}) {
  const S = STEPS[step], host = $('#step');
  host.classList.remove('enter');
  host.dataset.c = S.c;
  host.dataset.dir = o.dir || 'fwd';
  host.innerHTML = `<header class="step-head">${markSVG()}<p class="step-no">Steg ${step + 1} av ${STEPS.length}</p><h2 id="stepTitle" tabindex="-1">${S.title}</h2><div class="why"><p><strong>Hvorfor vi spør:</strong> ${S.why}</p><button type="button" class="peek" data-peek="${S.zone}">Se hvor det havner${icon('arrowR')}</button></div></header><div class="step-body">${S.body(o.newItem)}</div>`;
  $$('.step-head > :not(.step-mark)', host).forEach((el, i) => el.style.setProperty('--i', i));
  $$('.step-body > *', host).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 7)));
  if (o.anim) { void host.offsetWidth; host.classList.add('enter'); }
  if (reduce) $$('svg', host).forEach(s => s.pauseAnimations && s.pauseAnimations());
  const last = step === STEPS.length - 1;
  $('#prev').hidden = step === 0;
  $('#next').hidden = last;
  if (!last) $('#next').innerHTML = `Neste: ${STEPS[step + 1].label}${icon('arrowR', 'go')}`;
  if (o.zone !== false) zone = S.zone;
  if (last) updateSendBox();
  renderPreview(false);
  updateProgress();
  updateRaw();
  if (o.scroll) {
    const t = $('#skjema');
    const y = t.getBoundingClientRect().top + scrollY - ($('.topbar').offsetHeight + 8);
    if (Math.abs(scrollY - y) > 30) scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    $('#stepTitle').focus({ preventScroll: true });
  }
}
function go(i) {
  if (i < 0 || i >= STEPS.length || i === step) return;
  const dir = i > step ? 'fwd' : 'back';
  step = i;
  if (narrow() && $('#ws').dataset.view !== 'form') setView('form', false);
  renderStep({ anim: !reduce, dir, scroll: true });
  queueSave();
}

/* ---------- live preview ---------- */
const ZONES = ['head', 'about', 'journey', 'offers', 'where', 'modules', 'clients', 'contact'];
const lastHTML = {};
function buildPreview() {
  $('#pv').innerHTML = `<div class="ph-bar">${MARK_SMALL}<span>Sanctum</span></div><div class="cover" aria-hidden="true"><i></i><i></i><i></i></div>` +
    ZONES.map(z => `<section class="pz pz-${z}" data-pz="${z}"></section>`).join('') +
    '<p class="ph-foot">DIN HUB I SANCTUM</p>';
  ZONES.forEach(z => { lastHTML[z] = null; });
}
function sections() {
  const s = state, ex = t => `<span class="ex">${t}</span>`;
  const h = (t, isEx) => `<h4>${t}${isEx ? '<span class="ex-tag">eksempel</span>' : ''}</h4>`;
  const first = firstName(s.name);
  const initials = has(s.name) ? s.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() : '';
  const offers = s.offers.filter(o => has(o.name) || has(o.desc));
  const places = s.places.filter(p => has(p.where));
  const anyContact = has(s.instagram) || has(s.publicEmail) || has(s.phone) || has(s.siteUrl);
  const out = {};

  out.head = `<div class="avatar${photoPop ? ' pop-in' : ''}">${photo ? `<img src="${photo}" alt="">` : (initials ? esc(initials) : icon('spark'))}</div>
    ${has(s.practiceName) ? `<p class="p-practice">${esc(s.practiceName)}</p>` : ''}
    <h3 class="p-name">${has(s.name) ? esc(s.name) : ex('Ditt navn')}</h3>
    <p class="p-title">${has(s.title) ? esc(s.title) : ex('Det du gjør, på én linje')}</p>
    <p class="p-loc">${icon('pin')}${has(s.location) ? esc(s.location) : ex('Stedet ditt')}${s.languages.length ? ` · ${esc(s.languages.join(', '))}` : ''}</p>
    ${s.collab === 'Ja, gjerne' ? `<p class="badge">${icon('users')}Åpen for samarbeid</p>` : ''}
    <div class="p-actions" aria-hidden="true"><span class="p-btn pri">Ta kontakt</span><span class="p-btn">Følg</span></div>`;

  out.about = `${h('Om meg', !has(s.about) && !has(s.philosophy))}
    <p class="p-text">${has(s.about) ? nl(s.about) : ex('Her kommer noen setninger om deg, og om hva du hjelper folk med.')}</p>
    ${has(s.philosophy) ? `<blockquote class="p-quote">${esc(s.philosophy)}</blockquote>` : ''}`;

  const jEmpty = !has(s.years) && !has(s.training) && !s.traditions.length && !has(s.lineage);
  out.journey = `${h('Linjen min', jEmpty)}
    ${jEmpty ? `<p class="p-text">${ex('Tradisjoner, lærere, erfaring og utdanning.')}</p>` : ''}
    ${has(s.years) ? `<p class="p-years">${icon('spark')}${esc(s.years)} med erfaring</p>` : ''}
    ${s.traditions.length ? `<div class="p-tags">${s.traditions.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
    ${has(s.lineage) ? `<p class="p-k">Lærere og linjer</p><p class="p-text small">${nl(s.lineage)}</p>` : ''}
    ${has(s.training) ? `<p class="p-k">Utdanning</p><p class="p-text small">${nl(s.training)}</p>` : ''}`;

  const card = (o, isEx) => isEx
    ? `<div class="p-offer"><p class="o-name">${ex('Coaching 1:1')}</p><span class="o-pill">1:1</span><span class="o-pill">Fysisk</span><span class="o-pill">90 min</span></div>`
    : `<div class="p-offer"><p class="o-name">${has(o.name) ? esc(o.name) : 'Tilbud'}</p>${[o.format, o.mode, o.length].filter(has).map(x => `<span class="o-pill">${esc(x)}</span>`).join('')}${has(o.price) ? `<span class="o-pill price">${esc(o.price)}</span>` : ''}${has(o.desc) ? `<p class="o-desc">${nl(o.desc)}</p>` : ''}</div>`;
  out.offers = `${h('Tilbud', !offers.length)}
    ${s.audiences.length ? `<p class="p-for"><b>For</b>${s.audiences.map(esc).join(' · ')}</p>` : ''}
    <div class="p-offers">${offers.length ? offers.map(o => card(o)).join('') : card({}, true)}</div>`;

  const wEmpty = !has(s.base) && !places.length;
  out.where = `${h('Her finner du meg', wEmpty)}
    ${has(s.base) ? `<p class="p-text">${icon('pin')} ${esc(s.base)}</p>` : ''}
    <ul class="p-places">${places.length
      ? places.map(p => `<li><span class="dot"></span><span><strong>${esc(p.where)}</strong>${has(p.when) ? `<em>${esc(p.when)}</em>` : ''}</span></li>`).join('')
      : (wEmpty ? `<li><span class="dot"></span><span>${ex('Festival, sommer')}</span></li><li><span class="dot"></span><span>${ex('Retreat, høst')}</span></li>` : '')}</ul>
    ${s.travel === 'Ja, gjerne' || s.travel === 'Av og til' ? `<p class="p-text small" style="margin-top:10px">${icon('globe')} Reiser for å holde ${s.travel === 'Av og til' ? 'noe av og til' : 'kurs og økter'}</p>` : ''}`;

  const mods = s.modules;
  out.modules = `${h('På huben min', !mods.length)}
    <div class="p-mods">${(mods.length ? mods : ['Kurs og læringsmoduler', 'Kalender og arrangementer']).map(m => `<span class="p-mod${mods.length ? '' : ' ex'}">${icon(MOD_ICON[m] || 'spark')}<span>${mods.length ? esc(m) : `<span class="ex">${esc(m)}</span>`}</span></span>`).join('')}</div>
    ${has(s.learningIdeas) ? `<div class="p-course"><b>${icon('book')}Kurs</b>${nl(s.learningIdeas)}</div>` : ''}`;

  const tools = s.clientTools.length ? s.clientTools : ['Øvelser og lydfiler', 'Journal mellom øktene'];
  out.clients = `${h('For klientene mine', !s.clientTools.length)}
    <div class="p-room"><p class="room-t">${icon('lock')}Klientrom</p>
    <p class="room-s">Logg inn for å få tilgang. Det du skriver her, deler du bare med ${first ? esc(first) : 'coachen din'}.</p>
    <ul>${tools.map(t => `<li class="${s.clientTools.length ? '' : 'ex-li'}">${icon('check')}${esc(t)}</li>`).join('')}</ul>
    <span class="room-btn">Logg inn som klient</span></div>`;

  let c;
  if (!s.showContact) c = '<p class="p-text small ex">Kontaktinfo er skjult. Folk tar kontakt via knappen øverst.</p>';
  else if (anyContact) c = `<ul class="p-contact">${has(s.instagram) ? `<li>${icon('link')}${esc(s.instagram)}</li>` : ''}${has(s.publicEmail) ? `<li>${icon('mail')}${esc(s.publicEmail)}</li>` : ''}${has(s.phone) ? `<li>${icon('tel')}${esc(s.phone)}</li>` : ''}${has(s.siteUrl) ? `<li>${icon('globe')}${esc(s.siteUrl)}</li>` : ''}</ul>`;
  else c = `<ul class="p-contact"><li>${icon('link')}${ex('@dittnavn')}</li><li>${icon('mail')}${ex('navn@eksempel.no')}</li></ul>`;
  out.contact = `${h('Kontakt', s.showContact && !anyContact)}${c}`;
  return out;
}
function pulse(el) { el.classList.add('upd'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('upd'), 650); }
function renderPreview(fromUser) {
  const html = sections();
  ZONES.forEach(z => {
    const el = $(`[data-pz="${z}"]`);
    if (!el) return;
    if (lastHTML[z] !== html[z]) { el.innerHTML = html[z]; lastHTML[z] = html[z]; if (fromUser && !reduce) pulse(el); }
    el.classList.toggle('hl', z === zone);
  });
  photoPop = false;
}
function peek(z) {
  zone = z;
  renderPreview(false);
  const el = $(`[data-pz="${z}"]`);
  if (narrow()) {
    setView('profile', false);
    requestAnimationFrame(() => {
      const y = el.getBoundingClientRect().top + scrollY - ($('.topbar').offsetHeight + 24);
      scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  } else {
    $('#pv').scrollTo({ top: Math.max(0, el.offsetTop - 60), behavior: reduce ? 'auto' : 'smooth' });
  }
  if (!reduce) setTimeout(() => pulse(el), 250);
}
function setView(v, scroll = true) {
  const ws = $('#ws');
  ws.dataset.view = v;
  $('#seg').dataset.v = v;
  $$('#seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  const col = v === 'form' ? $('#formCol') : $('#pvCol');
  if (!reduce) { col.classList.remove('vin'); void col.offsetWidth; col.classList.add('vin'); }
  if (scroll) {
    const y = ws.getBoundingClientRect().top + scrollY - ($('.topbar').offsetHeight + 8);
    if (scrollY > y) scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
}

/* ---------- send, copy, delete ---------- */
const fmtDate = iso => { try { return new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
function updateStatePill() {
  const el = $('#statePill');
  if (!el) return;
  el.className = 'state-pill' + (status === 'submitted' ? ' sent' : '');
  el.innerHTML = status === 'submitted' ? `${icon('check')}Sendt inn ${esc(fmtDate(submittedAt))}` : `${icon('pen')}Utkast, ikke sendt inn ennå`;
}
function updateSendBox() {
  const lead = $('#sendLead');
  if (!lead) return;
  const name = esc(CFG.contactName);
  if (status === 'submitted') {
    lead.innerHTML = `Svarene dine er sendt inn. Du kan fortsatt endre dem, de lagres automatisk. Trykk på knappen igjen hvis du vil si fra til ${name} at noe er nytt.`;
    $('#sentNote').hidden = false;
    $('#sentNote span').textContent = `Sendt inn ${fmtDate(submittedAt)}`;
    $('#submitBtn span').textContent = 'Send inn på nytt';
  } else {
    lead.innerHTML = `Når du sender inn, ser ${name} svarene dine og setter opp en første versjon av huben. Du kan fortsatt gjøre endringer etterpå.`;
    $('#sentNote').hidden = true;
    $('#submitBtn span').textContent = `Send inn til ${CFG.contactName}`;
  }
}
async function submit(btn) {
  const msg = $('#sendMsg');
  msg.className = 'copy-msg';
  msg.textContent = 'Sender…';
  btn.disabled = true;
  try {
    dirty = true;
    await flush();
    if (dirty) throw new Error('Svarene ble ikke lagret. Sjekk nettet og prøv igjen.');
    const r = await api('POST', '/api/profile/submit', {});
    status = 'submitted';
    submittedAt = r.submittedAt;
    msg.textContent = `Sendt. ${CFG.contactName} ser svarene dine og tar kontakt.`;
    msg.className = 'copy-msg ok';
    updateSendBox();
    updateStatePill();
    petals(btn);
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'copy-msg warn';
  } finally {
    btn.disabled = false;
  }
}
const summary = () => SH.summaryText(state, account ? { name: account.name } : {});
function updateRaw() { const r = $('#raw'); if (r) r.value = summary(); }
function doCopy() {
  const txt = summary(), raw = $('#raw'), msg = $('#sendMsg');
  if (raw) raw.value = txt;
  let p;
  try { p = navigator.clipboard.writeText(txt); } catch (e) { p = Promise.reject(e); }
  Promise.resolve(p).then(() => {
    msg.textContent = 'Kopiert.';
    msg.className = 'copy-msg ok';
  }).catch(() => {
    if (raw) { raw.focus(); raw.select(); }
    msg.textContent = 'Kopieringen gikk ikke automatisk. Teksten er markert: hold fingeren på den og velg Kopier.';
    msg.className = 'copy-msg warn';
  });
}
async function deleteMe() {
  const m = $('#delMsg');
  m.textContent = '';
  try {
    clearTimeout(saveT); clearTimeout(retryT);
    dirty = false;
    await api('DELETE', '/api/me');
    leaveApp('Profilen din er slettet. Takk for at du var med.', 'register');
  } catch (e) {
    m.textContent = e.message;
  }
}

function petals(el) {
  if (reduce) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cv = document.createElement('canvas');
  cv.className = 'petals';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const cols = ['--sage', '--gold', '--rose', '--copper', '--forest'].map(v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; });
  probe.remove();
  const ps = Array.from({ length: 46 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = 4 + Math.random() * 8;
    return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.26, s: 5 + Math.random() * 8, c: cols[i % cols.length], sw: Math.random() * 6.28 };
  });
  const t0 = performance.now();
  (function frame(t) {
    const k = (t - t0) / 2400;
    ctx.clearRect(0, 0, W, H);
    if (k >= 1) { cv.remove(); return; }
    ps.forEach(p => {
      p.vy += 0.15; p.vx *= 0.985; p.vy *= 0.985; p.sw += 0.07;
      p.x += p.vx + Math.sin(p.sw) * 0.7; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    requestAnimationFrame(frame);
  })(t0);
}

/* ---------- photo ---------- */
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('Kunne ikke lese bildet.'));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Kunne ikke åpne bildet. Prøv et JPG- eller PNG-bilde.'));
      img.onload = () => {
        const sc = Math.min(1, 520 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * sc));
        cv.height = Math.max(1, Math.round(img.height * sc));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        try { resolve(cv.toDataURL('image/jpeg', 0.84)); } catch (e) { reject(new Error('Kunne ikke bruke bildet.')); }
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
async function setPhoto(dataUrl) {
  const prev = photo;
  photo = dataUrl;
  photoPop = !!dataUrl;
  zone = 'head';
  renderStep({ zone: false });
  setSave('pending');
  try {
    if (dataUrl) await api('PUT', '/api/profile/photo', { dataUrl });
    else await api('DELETE', '/api/profile/photo');
    setSave(dirty ? 'pending' : 'saved');
  } catch (e) {
    if (e.status === 401) return sessionLost();
    photo = prev;
    renderStep({ zone: false });
    setSave('error');
    const pe = $('#photoErr');
    if (pe) pe.textContent = e.message;
  }
}

/* ---------- auth ---------- */
function setAuthTab(t) {
  $('#authSeg').dataset.v = t;
  $$('#authSeg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $('#regForm').hidden = t !== 'register';
  $('#loginForm').hidden = t !== 'login';
}
function clearErr(f) {
  $$('[aria-invalid]', f).forEach(el => el.removeAttribute('aria-invalid'));
  $('.form-err', f).textContent = '';
}
function showErr(f, field, msg) {
  if (field) {
    const el = f.querySelector(`[name="${field}"]`);
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
  $('.form-err', f).textContent = msg;
}
function busy(f, on) {
  f.classList.toggle('busy', on);
  $('button[type="submit"]', f).disabled = on;
}
const val = id => document.getElementById(id).value;

async function onRegister(e) {
  e.preventDefault();
  const f = e.currentTarget;
  clearErr(f);
  $('#authMsg').hidden = true;
  const name = val('r-name').trim(), email = val('r-email').trim(), pin = val('r-pin'), pin2 = val('r-pin2');
  const consent = document.getElementById('r-consent').checked;
  if (!name) return showErr(f, 'name', 'Skriv navnet ditt.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(f, 'email', 'Skriv en gyldig e-postadresse.');
  if (!/^\d{6}$/.test(pin)) return showErr(f, 'pin', 'PIN-koden må være 6 sifre.');
  if (SH.weakPin(pin)) return showErr(f, 'pin', 'Velg en PIN-kode som er vanskeligere å gjette, ikke for eksempel 123456 eller 111111.');
  if (pin !== pin2) return showErr(f, 'pin2', 'PIN-kodene er ikke like. Skriv den samme to ganger.');
  if (!consent) return showErr(f, 'consent', 'Kryss av for at du har lest hvordan svarene lagres.');
  busy(f, true);
  try {
    const d = await api('POST', '/api/register', { name, email, pin, consent: true });
    f.reset();
    enterApp(d, true);
  } catch (err) {
    showErr(f, err.data && err.data.field, err.message);
    if (err.status === 409) $('#l-email').value = email;
  } finally {
    busy(f, false);
  }
}
async function onLogin(e) {
  e.preventDefault();
  const f = e.currentTarget;
  clearErr(f);
  const email = val('l-email').trim(), pin = val('l-pin');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(f, 'email', 'Skriv e-posten du brukte da du lagde profilen.');
  if (!/^\d{6}$/.test(pin)) return showErr(f, 'pin', 'PIN-koden er 6 sifre.');
  busy(f, true);
  try {
    const d = await api('POST', '/api/login', { email, pin });
    f.reset();
    $('#authMsg').hidden = true;
    enterApp(d, false);
  } catch (err) {
    showErr(f, null, err.message);
    document.getElementById('l-pin').value = '';
    document.getElementById('l-pin').focus();
  } finally {
    busy(f, false);
  }
}

function enterApp(d, isNew) {
  account = d.user;
  state = adoptAnswers(d.answers);
  step = Math.min(Math.max(parseInt(d.step, 10) || 0, 0), STEPS.length - 1);
  photo = d.photo || null;
  status = d.status || 'draft';
  submittedAt = d.submittedAt || null;
  dirty = false;
  if (pendingLocal && pendingLocal.email === account.email) {
    state = pendingLocal.answers;
    step = pendingLocal.step;
    dirty = true;
  }
  pendingLocal = null;
  document.body.dataset.auth = 'in';
  $('#helloWord').textContent = isNew ? 'Velkommen' : 'Hei igjen';
  $('#helloName').textContent = firstName(state.name || account.name) || 'deg';
  updateStatePill();
  setSave(dirty ? 'pending' : 'saved');
  buildProgress();
  buildPreview();
  renderStep({ anim: !reduce });
  setView('form', false);
  if (dirty) queueSave();
  scrollTo({ top: 0, behavior: 'auto' });
}
function leaveApp(message, tab) {
  account = null;
  state = blank();
  photo = null;
  status = 'draft';
  submittedAt = null;
  dirty = false;
  clearTimeout(saveT); clearTimeout(retryT);
  document.body.dataset.auth = 'out';
  setAuthTab(tab || 'login');
  const m = $('#authMsg');
  m.textContent = message || '';
  m.hidden = !message;
  scrollTo({ top: 0, behavior: 'auto' });
}
function sessionLost() {
  if (!account) return;
  pendingLocal = { email: account.email, answers: state, step };
  const email = account.email;
  leaveApp('Du ble logget ut. Logg inn igjen, så lagres det du skrev.', 'login');
  $('#l-email').value = email;
}
async function logout() {
  try { await flush(); } catch (e) { /* ignore */ }
  try { await api('POST', '/api/logout', {}); } catch (e) { /* ignore */ }
  leaveApp('Du er logget ut. Logg inn med e-post og PIN-kode når du vil fortsette.', 'login');
}

/* ---------- events ---------- */
function changed() { renderPreview(true); updateProgress(); updateRaw(); queueSave(); }
function setZoneFrom(el) { const z = el.closest('#step [data-zone]'); if (z) zone = z.dataset.zone; }

document.addEventListener('input', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('pin')) { t.value = t.value.replace(/\D/g, '').slice(0, 6); return; }
  const k = t.dataset && t.dataset.k;
  if (!k || !account) return;
  setP(k, t.type === 'checkbox' ? t.checked : t.value);
  setZoneFrom(t);
  changed();
  if (k === 'name') $('#helloName').textContent = firstName(t.value || account.name) || 'deg';
});
document.addEventListener('focusin', e => {
  const z = e.target.closest && e.target.closest('#step [data-zone]');
  if (z && z.dataset.zone !== zone) { zone = z.dataset.zone; renderPreview(false); }
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Enter' && t.dataset && t.dataset.own) { e.preventDefault(); addOwn(t.dataset.own); }
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'f-photo') return;
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try { await setPhoto(await readPhoto(f)); } catch (err) { const pe = $('#photoErr'); if (pe) pe.textContent = err.message; }
});

function addOwn(k) {
  const inp = document.getElementById(fid(k) + '-own');
  if (!inp) return;
  const v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!v) { inp.focus(); return; }
  const arr = [...(getP(k) || [])];
  const ownBtn = $(`#step [data-own-add="${k}"]`);
  const known = $$(`#step [data-chip="${k}"]`).map(b => b.dataset.v);
  const match = known.find(x => x.toLowerCase() === v.toLowerCase()) || arr.find(x => x.toLowerCase() === v.toLowerCase()) || v;
  if (!arr.includes(match)) arr.push(match);
  setP(k, arr);
  setZoneFrom(ownBtn || inp);
  renderStep({ zone: false });
  changed();
  const ni = document.getElementById(fid(k) + '-own');
  if (ni) ni.focus({ preventScroll: true });
  const chip = $$(`#step [data-chip="${k}"]`).find(b => b.dataset.v === match);
  if (chip && !reduce) chip.classList.add('pop');
}

document.addEventListener('click', e => {
  const jump = e.target.closest('a[data-jump]');
  if (jump) {
    e.preventDefault();
    setAuthTab(jump.dataset.jump);
    $('#authMsg').hidden = true;
    $('#auth').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const f = jump.dataset.jump === 'login' ? $('#loginForm') : $('#regForm');
    setTimeout(() => { const first = $('input', f); if (first) first.focus({ preventScroll: true }); }, reduce ? 0 : 450);
    return;
  }
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.tab) { setAuthTab(d.tab); $('#authMsg').hidden = true; const f = d.tab === 'login' ? $('#loginForm') : $('#regForm'); const first = $('input', f); if (first) first.focus(); return; }
  if (d.pinToggle) {
    const f = document.getElementById(d.pinToggle);
    const show = b.getAttribute('aria-pressed') !== 'true';
    $$('input.pin', f).forEach(i => { i.type = show ? 'text' : 'password'; });
    b.setAttribute('aria-pressed', String(show));
    b.textContent = show ? 'Skjul' : 'Vis';
    return;
  }
  if (b.id === 'logoutBtn') { logout(); return; }
  if (!account) return;
  if (d.chip !== undefined) {
    const k = d.chip, v = d.v, multi = d.multi === '1';
    if (multi) { const arr = [...(getP(k) || [])]; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); setP(k, arr); }
    else setP(k, getP(k) === v ? '' : v);
    const cur = getP(k);
    $$('[data-chip]', b.parentElement).forEach(x => x.setAttribute('aria-pressed', String(multi ? cur.includes(x.dataset.v) : cur === x.dataset.v)));
    if (!reduce) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    setZoneFrom(b);
    changed();
    return;
  }
  if (d.ownAdd) { addOwn(d.ownAdd); return; }
  if (d.fill) {
    setP(d.fill, d.v);
    const inp = document.getElementById(fid(d.fill));
    if (inp) { inp.value = d.v; if (!reduce) { inp.classList.remove('flash'); void inp.offsetWidth; inp.classList.add('flash'); } }
    setZoneFrom(b); changed(); return;
  }
  if (d.start) {
    const k = d.start, cur = getP(k) || '';
    const nv = has(cur) ? cur.replace(/\s*$/, '') + '\n' + d.v : d.v;
    setP(k, nv);
    const inp = document.getElementById(fid(k));
    if (inp) { inp.value = nv; inp.focus(); inp.setSelectionRange(nv.length, nv.length); }
    setZoneFrom(b); changed(); return;
  }
  if (d.add) {
    const k = d.add;
    state[k].push(k === 'offers' ? blankOffer() : blankPlace());
    const i = state[k].length - 1;
    renderStep({ newItem: { k, i }, zone: false });
    const f = document.getElementById(fid(`${k}.${i}.${k === 'offers' ? 'name' : 'where'}`));
    if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
    changed();
    return;
  }
  if (d.remove) { state[d.remove].splice(+d.i, 1); renderStep({ zone: false }); changed(); return; }
  if (d.go !== undefined) { go(+d.go); return; }
  if (d.peek) { peek(d.peek); return; }
  if (d.view) { setView(d.view); return; }
  if (b.hasAttribute('data-photo-clear')) { setPhoto(null); return; }
  if (d.del === 'ask') { $('#delAsk').hidden = true; $('#delConfirm').hidden = false; $('[data-del="no"]').focus(); return; }
  if (d.del === 'no') { $('#delAsk').hidden = false; $('#delConfirm').hidden = true; $('[data-del="ask"]').focus(); return; }
  if (d.del === 'yes') { deleteMe(); return; }
  if (b.id === 'prev') { go(step - 1); return; }
  if (b.id === 'next') { go(step + 1); return; }
  if (b.id === 'submitBtn') { submit(b); return; }
  if (b.id === 'copyBtn') { doCopy(); return; }
});

/* ---------- boot ---------- */
async function boot() {
  $$('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon, el.classList.contains('go-wrap') ? 'go' : ''); });
  $$('[data-vis]').forEach(el => { el.outerHTML = tag(el.dataset.vis); });
  if (reduce) $$('svg').forEach(s => s.pauseAnimations && s.pauseAnimations());
  $('#regForm').addEventListener('submit', onRegister);
  $('#loginForm').addEventListener('submit', onLogin);
  try { CFG = Object.assign(CFG, await api('GET', '/api/config')); } catch (e) { /* defaults */ }
  $$('[data-cfg]').forEach(el => { el.textContent = CFG[el.dataset.cfg] || el.textContent; });
  try {
    const d = await api('GET', '/api/me');
    enterApp(d, false);
  } catch (e) {
    document.body.dataset.auth = 'out';
    setAuthTab('register');
  }
}
boot();
})();
