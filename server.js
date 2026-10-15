'use strict';
/*
 * Sanctum hub-oppstart
 * Temporary profiles (name, e-mail, 6-digit PIN) for practitioners filling in their hub onboarding.
 * No accounts, no PIN recovery. The admin exports the answers and deletes the profile.
 * Only Node built-ins, plus `pg` when DATABASE_URL is set.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./src/store');
const sec = require('./src/security');
const { weakPin } = require('./public/shared.js');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const CONFIG = {
  contactName: process.env.CONTACT_NAME || 'Peder',
  contactEmail: process.env.CONTACT_EMAIL || 'peder@artum.no'
};
const USER_SESSION_MS = 30 * 24 * 3600 * 1000;
const ADMIN_SESSION_MS = 12 * 3600 * 1000;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ANSWERS_BYTES = 200 * 1024;
const MAX_PHOTO_CHARS = 900 * 1024;
const STEP_COUNT = 6;
const USER_COOKIE = 'sh_s';
const ADMIN_COOKIE = 'sh_a';

const ROOT = __dirname;
const STATIC_ROOTS = {
  '': path.join(ROOT, 'public'),
  cormorant: path.join(ROOT, 'node_modules', '@fontsource', 'cormorant-garamond'),
  inter: path.join(ROOT, 'node_modules', '@fontsource', 'inter')
};
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
};
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self'", "manifest-src 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"
].join('; ');

const store = createStore();
const limits = {
  register: sec.limiter(10, 60 * 60 * 1000),
  login: sec.limiter(30, 15 * 60 * 1000),
  admin: sec.limiter(10, 15 * 60 * 1000)
};

/* ---------- helpers ---------- */
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

function json(res, status, body, headers) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(headers || {}) });
  res.end(JSON.stringify(body));
}

const isSecure = req => req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Secure, cross-site-capable cookie over https (so the Replit preview iframe works too);
// CSRF is blocked by the custom X-Sanctum header every write must carry.
function cookieHeader(req, name, value, maxAgeMs) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`];
  if (isSecure(req)) attrs.push('Secure', 'SameSite=None', 'Partitioned');
  else attrs.push('SameSite=Lax');
  return attrs.join('; ');
}

function addCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, value) : [value]);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', c => {
      size += c.length;
      if (size > limit) tooBig = true;
      else chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'Det du sendte er for stort.'));
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' ? v : {});
      } catch (e) {
        reject(new HttpError(400, 'Kunne ikke lese det som ble sendt.'));
      }
    });
    req.on('error', reject);
  });
}

const cleanText = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const normEmail = v => String(v == null ? '' : v).trim().toLowerCase();
const validEmail = e => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isPin = p => /^\d{6}$/.test(p);
// Key order differs between the browser and Postgres JSONB, so compare with sorted keys.
function stableJson(v) {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

function profilePayload(u) {
  return {
    user: { name: u.name, email: u.email, createdAt: u.createdAt },
    answers: u.answers || {}, step: u.step || 0, status: u.status || 'draft',
    submittedAt: u.submittedAt || null, updatedAt: u.updatedAt, photo: u.photo || null
  };
}

async function startSession(req, res, userId, role) {
  const token = sec.newToken();
  const ms = role === 'admin' ? ADMIN_SESSION_MS : USER_SESSION_MS;
  await store.createSession({ tokenHash: sec.hashToken(token), userId, role, expiresAt: new Date(Date.now() + ms).toISOString() });
  addCookie(res, cookieHeader(req, role === 'admin' ? ADMIN_COOKIE : USER_COOKIE, token, ms));
}

async function endSession(req, res, cookieName) {
  const token = readCookie(req, cookieName);
  if (token) await store.deleteSession(sec.hashToken(token));
  addCookie(res, cookieHeader(req, cookieName, '', 0));
}

async function currentUser(req) {
  const token = readCookie(req, USER_COOKIE);
  if (!token) return null;
  const s = await store.getSession(sec.hashToken(token));
  if (!s || s.role !== 'user' || !s.userId) return null;
  return store.getUser(s.userId);
}

async function requireUser(req) {
  const u = await currentUser(req);
  if (!u) fail(401, 'Du er ikke logget inn.');
  return u;
}

async function requireAdmin(req) {
  if (!ADMIN_KEY) fail(503, 'Admin er ikke satt opp. Legg inn ADMIN_KEY som secret og start appen på nytt.');
  const token = readCookie(req, ADMIN_COOKIE);
  const s = token ? await store.getSession(sec.hashToken(token)) : null;
  if (!s || s.role !== 'admin') fail(401, 'Logg inn som admin.');
}

/* ---------- routes ---------- */
const routes = [];
function route(method, pattern, handler, opts) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, limit: (opts && opts.limit) || 32 * 1024 });
}

route('GET', '/api/config', async (req, res) => {
  json(res, 200, { ...CONFIG, adminEnabled: !!ADMIN_KEY });
});

route('POST', '/api/register', async (req, res, { body }) => {
  if (!limits.register(clientIp(req))) fail(429, 'For mange nye profiler herfra på kort tid. Vent litt og prøv igjen.');
  const name = cleanText(body.name, 80);
  const email = normEmail(body.email);
  const pin = String(body.pin == null ? '' : body.pin);
  if (!name) fail(400, 'Skriv navnet ditt.', { field: 'name' });
  if (!validEmail(email)) fail(400, 'Skriv en gyldig e-postadresse.', { field: 'email' });
  if (!isPin(pin)) fail(400, 'PIN-koden må være 6 sifre.', { field: 'pin' });
  if (weakPin(pin)) fail(400, 'Velg en PIN-kode som er vanskeligere å gjette, ikke for eksempel 123456 eller 111111.', { field: 'pin' });
  if (body.consent !== true) fail(400, 'Kryss av for at du har lest hvordan svarene lagres.', { field: 'consent' });
  const exists = 'Det finnes allerede en profil med denne e-posten. Logg inn med PIN-koden din.';
  if (await store.findUserByEmail(email)) fail(409, exists, { field: 'email' });
  const { hash, salt } = await sec.hashPin(pin);
  let user;
  try {
    user = await store.createUser({
      id: crypto.randomUUID(), name, email, pinHash: hash, pinSalt: salt,
      answers: { name }, consentAt: new Date().toISOString()
    });
  } catch (e) {
    if (e.code === 'EXISTS') fail(409, exists, { field: 'email' });
    throw e;
  }
  await startSession(req, res, user.id, 'user');
  json(res, 201, profilePayload(user));
});

route('POST', '/api/login', async (req, res, { body }) => {
  if (!limits.login(clientIp(req))) fail(429, 'For mange forsøk herfra. Vent et kvarter og prøv igjen.');
  const email = normEmail(body.email);
  const pin = String(body.pin == null ? '' : body.pin);
  const wrong = 'E-post eller PIN-kode stemmer ikke. Etter 5 feil låses profilen i 15 minutter.';
  if (!validEmail(email) || !isPin(pin)) fail(401, wrong);
  const user = await store.findUserByEmail(email);
  if (!user) {
    await sec.dummyVerify(pin);
    fail(401, wrong);
  }
  const lockedFor = user.lockedUntil ? Date.parse(user.lockedUntil) - Date.now() : 0;
  if (lockedFor > 0) {
    const min = Math.ceil(lockedFor / 60000);
    fail(429, `Profilen er låst etter for mange feil. Prøv igjen om ${min} ${min === 1 ? 'minutt' : 'minutter'}.`);
  }
  if (!(await sec.verifyPin(pin, user.pinHash, user.pinSalt))) {
    const n = (user.failedAttempts || 0) + 1;
    if (n >= LOCK_AFTER) {
      await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS).toISOString() });
      fail(429, 'For mange feil. Profilen er låst i 15 minutter.');
    }
    await store.updateUser(user.id, { failedAttempts: n });
    fail(401, wrong);
  }
  if (user.failedAttempts || user.lockedUntil) await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: null });
  await startSession(req, res, user.id, 'user');
  json(res, 200, profilePayload(user));
});

route('POST', '/api/logout', async (req, res) => {
  await endSession(req, res, USER_COOKIE);
  json(res, 200, { ok: true });
});

route('GET', '/api/me', async (req, res) => {
  const user = await requireUser(req);
  json(res, 200, profilePayload(user));
});

route('PUT', '/api/profile', async (req, res, { body }) => {
  const user = await requireUser(req);
  const answers = body.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) fail(400, 'Svarene mangler.');
  if (Buffer.byteLength(JSON.stringify(answers)) > MAX_ANSWERS_BYTES) fail(413, 'Svarene er for lange. Kort ned noen av tekstene.');
  const step = Math.min(Math.max(parseInt(body.step, 10) || 0, 0), STEP_COUNT - 1);
  // Moving between steps is not a change; only new answers move "last changed".
  if (stableJson(answers) === stableJson(user.answers || {})) {
    if (step !== user.step) await store.updateUser(user.id, { step });
    return json(res, 200, { ok: true, updatedAt: user.updatedAt });
  }
  const updatedAt = new Date().toISOString();
  await store.updateUser(user.id, { answers, step, updatedAt });
  json(res, 200, { ok: true, updatedAt });
}, { limit: MAX_ANSWERS_BYTES + 4096 });

route('PUT', '/api/profile/photo', async (req, res, { body }) => {
  const user = await requireUser(req);
  const dataUrl = String(body.dataUrl || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) fail(400, 'Bildet må være JPG, PNG eller WebP.');
  if (dataUrl.length > MAX_PHOTO_CHARS) fail(413, 'Bildet er for stort. Prøv et annet bilde.');
  const updatedAt = new Date().toISOString();
  await store.updateUser(user.id, { photo: dataUrl, updatedAt });
  json(res, 200, { ok: true, updatedAt });
}, { limit: MAX_PHOTO_CHARS + 1024 });

route('DELETE', '/api/profile/photo', async (req, res) => {
  const user = await requireUser(req);
  const updatedAt = new Date().toISOString();
  await store.updateUser(user.id, { photo: null, updatedAt });
  json(res, 200, { ok: true, updatedAt });
});

route('POST', '/api/profile/submit', async (req, res) => {
  const user = await requireUser(req);
  const t = new Date().toISOString();
  await store.updateUser(user.id, { status: 'submitted', submittedAt: t, updatedAt: t });
  json(res, 200, { ok: true, status: 'submitted', submittedAt: t });
});

route('DELETE', '/api/me', async (req, res) => {
  const user = await requireUser(req);
  await store.deleteUser(user.id);
  addCookie(res, cookieHeader(req, USER_COOKIE, '', 0));
  json(res, 200, { ok: true });
});

/* admin */
route('POST', '/api/admin/login', async (req, res, { body }) => {
  if (!ADMIN_KEY) fail(503, 'Admin er ikke satt opp. Legg inn ADMIN_KEY som secret og start appen på nytt.');
  if (!limits.admin(clientIp(req))) fail(429, 'For mange forsøk. Vent et kvarter og prøv igjen.');
  if (!sec.safeEqual(String(body.key || ''), ADMIN_KEY)) fail(401, 'Nøkkelen stemmer ikke.');
  await startSession(req, res, null, 'admin');
  json(res, 200, { ok: true });
});

route('POST', '/api/admin/logout', async (req, res) => {
  await endSession(req, res, ADMIN_COOKIE);
  json(res, 200, { ok: true });
});

route('GET', '/api/admin/profiles', async (req, res) => {
  await requireAdmin(req);
  json(res, 200, { profiles: await store.listUsers(), store: store.kind });
});

const exportShape = u => ({
  id: u.id, name: u.name, email: u.email, status: u.status, answers: u.answers || {}, photo: u.photo || null,
  consentAt: u.consentAt || null, createdAt: u.createdAt, updatedAt: u.updatedAt, submittedAt: u.submittedAt || null
});

route('GET', '/api/admin/profiles/:id', async (req, res, { params }) => {
  await requireAdmin(req);
  const u = await store.getUser(params.id);
  if (!u) fail(404, 'Fant ikke profilen. Den kan allerede være slettet.');
  json(res, 200, { profile: exportShape(u) });
});

route('DELETE', '/api/admin/profiles/:id', async (req, res, { params }) => {
  await requireAdmin(req);
  const ok = await store.deleteUser(params.id);
  if (!ok) fail(404, 'Fant ikke profilen. Den kan allerede være slettet.');
  json(res, 200, { ok: true });
});

route('GET', '/api/admin/export', async (req, res) => {
  await requireAdmin(req);
  const users = await store.allUsersFull();
  const day = new Date().toISOString().slice(0, 10);
  json(res, 200, { exportedAt: new Date().toISOString(), count: users.length, profiles: users.map(exportShape) }, {
    'Content-Disposition': `attachment; filename="sanctum-hub-${day}.json"`
  });
});

/* ---------- static files ---------- */
async function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return notFound(res); }
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin') rel = '/admin.html';
  let base = STATIC_ROOTS[''];
  let longCache = false;
  const font = rel.match(/^\/fonts\/(cormorant|inter)(\/.+)$/);
  if (font) { base = STATIC_ROOTS[font[1]]; rel = font[2]; longCache = true; }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep)) return notFound(res);
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) return notFound(res);
  let st;
  try { st = await fs.promises.stat(file); } catch (e) { return notFound(res); }
  if (!st.isFile()) return notFound(res);
  res.writeHead(200, {
    'Content-Type': MIME[ext],
    'Content-Length': st.size,
    'Cache-Control': longCache ? 'public, max-age=2592000, immutable' : 'no-cache'
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Fant ikke siden.');
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', CSP);

  const url = new URL(req.url, 'http://local');
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res);
    return serveStatic(req, res, pathname);
  }

  try {
    const r = routes.find(x => x.method === req.method && x.re.test(pathname));
    if (!r) fail(404, 'Fant ikke denne adressen.');
    if (req.method !== 'GET' && req.headers['x-sanctum'] !== '1') fail(403, 'Forespørselen ble avvist.');
    const m = pathname.match(r.re);
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req, r.limit) : {};
    await r.handler(req, res, { body, params });
  } catch (err) {
    if (err instanceof HttpError) return json(res, err.status, { error: err.message, ...err.extra });
    console.error('[server]', err);
    if (!res.headersSent) json(res, 500, { error: 'Noe gikk galt hos oss. Prøv igjen om litt.' });
  }
});

(async () => {
  await store.init();
  if (store.kind === 'file' && process.env.REPLIT_DEPLOYMENT) {
    console.warn('[sanctum-hub] DATABASE_URL mangler: svarene lagres i en fil som kan forsvinne. Legg til PostgreSQL i Replit.');
  }
  if (!ADMIN_KEY) console.warn('[sanctum-hub] ADMIN_KEY er ikke satt: /admin er av.');
  setInterval(() => store.purgeExpiredSessions().catch(() => {}), 60 * 60 * 1000).unref();
  server.listen(PORT, '0.0.0.0', () => console.log(`[sanctum-hub] http://localhost:${PORT} (lagring: ${store.kind})`));
})().catch(err => {
  console.error('[sanctum-hub] kunne ikke starte', err);
  process.exit(1);
});
