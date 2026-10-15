(() => {
'use strict';
const SH = window.SanctumShared;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => { if (!iso) return ''; try { return new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
const slug = s => String(s || 'profil').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profil';

let list = [], currentId = null, current = null;

async function api(method, url, body) {
  const headers = { 'X-Sanctum': '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  } catch (e) {
    throw Object.assign(new Error('Fikk ikke kontakt med serveren.'), { status: 0 });
  }
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) throw Object.assign(new Error((data && data.error) || 'Noe gikk galt.'), { status: r.status });
  return data || {};
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function statusOf(p) {
  if (p.status !== 'submitted') return { cls: '', label: 'Utkast' };
  const changed = p.updatedAt && p.submittedAt && Date.parse(p.updatedAt) - Date.parse(p.submittedAt) > 2000;
  return changed ? { cls: 'changed', label: 'Endret etter innsending' } : { cls: 'sent', label: 'Sendt inn' };
}
const displayName = p => (p.answers && SH.text(p.answers.name)) || p.name;

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const rows = list.filter(p => !q || displayName(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  const sent = list.filter(p => p.status === 'submitted').length;
  $('#countNote').textContent = list.length ? `${list.length} ${list.length === 1 ? 'profil' : 'profiler'}, ${sent} sendt inn.` : 'Ingen profiler ennå.';
  $('#list').innerHTML = rows.map(p => {
    const st = statusOf(p);
    const started = SH.stepsStarted(p.answers || {});
    return `<button type="button" class="adm-row" data-id="${esc(p.id)}" aria-current="${p.id === currentId}">
      <span class="top"><b>${esc(displayName(p))}</b><span class="pill ${st.cls}">${st.label}</span></span>
      <small>${esc(p.email)}</small>
      <span class="mini-prog" aria-label="${started.filter(Boolean).length} av 6 steg påbegynt">${started.map(on => `<i class="${on ? 'on' : ''}"></i>`).join('')}</span>
      <small>Sist endret ${esc(fmt(p.updatedAt))}</small>
    </button>`;
  }).join('') || (list.length ? '<p class="adm-empty">Ingen treff.</p>' : '');
}

function renderDetail() {
  const el = $('#detail');
  if (!current) { el.innerHTML = '<p class="adm-empty">Velg en profil for å se svarene.</p>'; return; }
  const p = current, st = statusOf(p);
  const secs = SH.sections(p.answers || {});
  el.innerHTML = `
    <div class="who-h">
      ${p.photo ? `<img class="adm-photo" src="${p.photo}" alt="Bilde av ${esc(displayName(p))}">` : ''}
      <div>
        <h2>${esc(displayName(p))}</h2>
        <p class="adm-meta"><span>${esc(p.email)}</span><span class="pill ${st.cls}">${st.label}</span></p>
      </div>
    </div>
    <p class="adm-meta"><span>Opprettet ${esc(fmt(p.createdAt))}</span><span>Sist endret ${esc(fmt(p.updatedAt))}</span>${p.submittedAt ? `<span>Sendt inn ${esc(fmt(p.submittedAt))}</span>` : ''}${p.consentAt ? `<span>Samtykke ${esc(fmt(p.consentAt))}</span>` : ''}</p>
    <div class="adm-tools">
      <button type="button" class="btn-pri" id="dlOne">Last ned svarene (JSON)</button>
      <button type="button" class="btn-sec" id="copyOne">Kopier som tekst</button>
      ${p.photo ? '<button type="button" class="btn-sec" id="dlPhoto">Last ned bildet</button>' : ''}
      <button type="button" class="btn-sec" id="delAsk">Slett profilen</button>
    </div>
    <div class="confirm" id="delConfirm" hidden>
      <p><strong>Slette ${esc(displayName(p))} for godt?</strong> Last ned svarene først hvis du ikke har gjort det. Personen kan ikke logge inn igjen etterpå.</p>
      <div class="adm-tools"><button type="button" class="btn-danger" id="delYes">Ja, slett</button><button type="button" class="btn-sec" id="delNo">Avbryt</button></div>
    </div>
    ${secs.length ? secs.map(s => `<div class="adm-sec"><h3>${esc(s.title)}</h3><dl>${s.rows.map(([l, v]) => `<dt>${esc(l)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`).join('') : '<p class="adm-empty">Ingen svar ennå.</p>'}`;
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function openProfile(id) {
  currentId = id;
  renderList();
  $('#detail').innerHTML = '<p class="adm-empty">Henter…</p>';
  try {
    current = (await api('GET', `/api/admin/profiles/${encodeURIComponent(id)}`)).profile;
    renderDetail();
    if (matchMedia('(max-width: 959px)').matches) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    if (e.status === 401) return showLogin();
    current = null;
    $('#detail').innerHTML = `<p class="adm-empty">${esc(e.message)}</p>`;
  }
}

async function load() {
  try {
    const d = await api('GET', '/api/admin/profiles');
    list = d.profiles || [];
    const note = d.warning || (d.store === 'file' ? 'Lagring: fil. Legg inn SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY (de samme som i Sanctum) før du deler lenken, ellers kan svarene forsvinne når appen publiseres eller starter på nytt.' : '');
    $('#storeNote').textContent = note;
    $('#storeNote').hidden = !note;
    document.body.dataset.auth = 'in';
    if (currentId && !list.some(p => p.id === currentId)) { currentId = null; current = null; renderDetail(); }
    renderList();
  } catch (e) {
    showLogin(e.status === 503 ? e.message : '');
  }
}
function showLogin(msg) {
  document.body.dataset.auth = 'out';
  $('#loginErr').textContent = msg || '';
  setTimeout(() => $('#a-key').focus(), 50);
}

$('#keyForm').addEventListener('submit', async e => {
  e.preventDefault();
  const key = $('#a-key').value;
  if (!key) { $('#loginErr').textContent = 'Skriv admin-nøkkelen.'; return; }
  try {
    await api('POST', '/api/admin/login', { key });
    $('#a-key').value = '';
    $('#loginErr').textContent = '';
    await load();
  } catch (err) {
    $('#loginErr').textContent = err.message;
  }
});
$('#search').addEventListener('input', renderList);

document.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'logoutBtn') { try { await api('POST', '/api/admin/logout', {}); } catch (err) { /* ignore */ } list = []; current = null; currentId = null; showLogin(); return; }
  if (b.classList.contains('adm-row')) { openProfile(b.dataset.id); return; }
  if (!current) return;
  if (b.id === 'dlOne') {
    const day = new Date().toISOString().slice(0, 10);
    download(`sanctum-hub-${slug(displayName(current))}-${day}.json`, new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile: current }, null, 2)], { type: 'application/json' }));
    toast('Lastet ned.');
    return;
  }
  if (b.id === 'copyOne') {
    const txt = SH.summaryText(current.answers || {}, { name: current.name, email: current.email });
    try { await navigator.clipboard.writeText(txt); toast('Kopiert.'); } catch (err) { toast('Kunne ikke kopiere. Bruk JSON-nedlastingen.'); }
    return;
  }
  if (b.id === 'dlPhoto') {
    const m = /^data:(image\/(\w+));base64,(.*)$/.exec(current.photo || '');
    if (!m) return;
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    download(`sanctum-hub-${slug(displayName(current))}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`, new Blob([bytes], { type: m[1] }));
    return;
  }
  if (b.id === 'delAsk') { $('#delConfirm').hidden = false; $('#delNo').focus(); return; }
  if (b.id === 'delNo') { $('#delConfirm').hidden = true; return; }
  if (b.id === 'delYes') {
    b.disabled = true;
    try {
      await api('DELETE', `/api/admin/profiles/${encodeURIComponent(current.id)}`);
      const name = displayName(current);
      list = list.filter(p => p.id !== current.id);
      current = null; currentId = null;
      renderList(); renderDetail();
      toast(`${name} er slettet.`);
    } catch (err) {
      b.disabled = false;
      toast(err.message);
    }
  }
});

load();
})();
