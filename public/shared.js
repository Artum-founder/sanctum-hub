/* Shared between the browser (window.SanctumShared) and the server (require). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SanctumShared = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const STEP_LABELS = ['Deg', 'Linje', 'Tilbud', 'Hvor og når', 'Huben din', 'Til slutt'];
  const STEP_KEYS = [
    ['name', 'practiceName', 'title', 'location', 'languages', 'about'],
    ['traditions', 'lineage', 'years', 'training', 'philosophy'],
    ['audiences', 'offers'],
    ['base', 'places', 'travel', 'collab'],
    ['modules', 'learning', 'learningIdeas', 'clientTools', 'payment'],
    ['booking', 'instagram', 'publicEmail', 'phone', 'siteStatus', 'siteUrl', 'siteWish', 'notes']
  ];

  const text = v => (Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v == null ? '' : v)).trim();
  const has = v => (typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : !!v);

  function filled(a, k) {
    const v = (a || {})[k];
    if (k === 'offers') return Array.isArray(v) && v.some(o => o && (has(o.name) || has(o.desc)));
    if (k === 'places') return Array.isArray(v) && v.some(p => p && has(p.where));
    return has(v);
  }
  const stepsStarted = a => STEP_KEYS.map(keys => keys.some(k => filled(a, k)));

  // Readable answers, grouped the way the questionnaire asks them.
  function sections(a) {
    a = a || {};
    const out = [];
    const sec = (title, rows) => {
      const r = rows.map(([l, v]) => [l, text(v)]).filter(([, v]) => v);
      if (r.length) out.push({ title, rows: r });
    };
    const offers = (Array.isArray(a.offers) ? a.offers : []).filter(o => o && (has(o.name) || has(o.desc)));
    const places = (Array.isArray(a.places) ? a.places : []).filter(p => p && has(p.where));
    const anyContact = has(a.instagram) || has(a.publicEmail) || has(a.phone);
    sec('Deg', [['Navn', a.name], ['Navn på praksisen', a.practiceName], ['Kaller seg', a.title], ['Sted', a.location], ['Språk', a.languages], ['Om meg', a.about]]);
    sec('Linje', [['Tradisjoner og former', a.traditions], ['Lærere, skoler og linjer', a.lineage], ['Erfaring', a.years], ['Utdanning og kurs', a.training], ['Med egne ord', a.philosophy]]);
    sec('Tilbud', [['Jobber med', a.audiences]].concat(offers.map((o, i) => [
      'Tilbud ' + (i + 1),
      [o.name, [o.format, o.mode, o.length, o.price].filter(has).join(', '), o.desc].filter(has).join(' | ')
    ])));
    sec('Hvor og når', [['Tar imot', a.base]].concat(
      places.map(p => ['Skal være', [p.where, p.when].filter(has).join(', ')]),
      [['Reiser for å holde noe', a.travel], ['Samarbeid', a.collab]]
    ));
    sec('Huben', [['Moduler', a.modules], ['Læringsinnhold i dag', a.learning], ['Kurs og forløp', a.learningIdeas], ['Verktøy for klienter', a.clientTools], ['Betaling', a.payment]]);
    sec('Kontakt og hjemmeside', [
      ['Kontakt i dag', a.booking], ['Instagram', a.instagram], ['E-post på profilen', a.publicEmail], ['Telefon', a.phone],
      ['Vis kontaktinfo på profilen', anyContact ? (a.showContact === false ? 'Nei' : 'Ja') : ''],
      ['Hjemmeside i dag', a.siteStatus], ['Adresse', a.siteUrl], ['Interessert i', a.siteWish]
    ]);
    sec('Annet', [['Melding', a.notes]]);
    return out;
  }

  function summaryText(a, meta) {
    meta = meta || {};
    const lines = ['Sanctum hub, svar fra ' + (text(a && a.name) || meta.name || '(uten navn)')];
    if (meta.email) lines.push('Innlogging: ' + meta.email);
    lines.push('');
    sections(a).forEach(s => {
      lines.push(s.title.toUpperCase());
      s.rows.forEach(([l, v]) => lines.push(l + ': ' + v));
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  // Six identical digits, or six digits in a row up or down, are too easy to guess.
  function weakPin(pin) {
    if (!/^\d{6}$/.test(pin)) return false;
    if (/^(\d)\1{5}$/.test(pin)) return true;
    return '0123456789012345'.includes(pin) || '9876543210987654'.includes(pin);
  }

  return { STEP_LABELS, STEP_KEYS, text, has, filled, stepsStarted, sections, summaryText, weakPin };
});
