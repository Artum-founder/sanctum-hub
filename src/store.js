'use strict';
const fs = require('fs');
const path = require('path');

/*
 * Two stores with the same interface:
 *  - SupabaseStore: the same connection Sanctum uses. The Supabase address and the service role key,
 *    through Supabase's API, into the hub tables in the "tantric" schema of «sol».
 *  - FileStore otherwise, a JSON file for local testing. Not for published apps:
 *    a published Replit app does not keep files between restarts.
 */

const iso = d => (d ? new Date(d).toISOString() : null);
const nowIso = () => new Date().toISOString();

function publicListUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, answers: u.answers || {}, step: u.step || 0,
    status: u.status || 'draft', hasPhoto: !!u.photo || !!u.hasPhoto,
    createdAt: u.createdAt, updatedAt: u.updatedAt, submittedAt: u.submittedAt || null
  };
}

class FileStore {
  constructor(file) {
    this.file = file;
    this.data = { users: {}, sessions: {} };
    this.queue = Promise.resolve();
    this.kind = 'file';
  }

  async init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data.users = parsed.users || {};
      this.data.sessions = parsed.sessions || {};
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  persist() {
    const snapshot = JSON.stringify(this.data);
    const tmp = this.file + '.tmp';
    this.queue = this.queue
      .then(() => fs.promises.writeFile(tmp, snapshot, { mode: 0o600 }))
      .then(() => fs.promises.rename(tmp, this.file))
      .catch(err => console.error('[store] could not write', err));
    return this.queue;
  }

  async createUser(u) {
    const email = u.email;
    if (Object.values(this.data.users).some(x => x.email === email)) {
      throw Object.assign(new Error('exists'), { code: 'EXISTS' });
    }
    const t = nowIso();
    const user = {
      id: u.id, name: u.name, email, pinHash: u.pinHash, pinSalt: u.pinSalt,
      failedAttempts: 0, lockedUntil: null, answers: u.answers || {}, step: 0, status: 'draft',
      photo: null, consentAt: u.consentAt || null, createdAt: t, updatedAt: t, submittedAt: null
    };
    this.data.users[user.id] = user;
    await this.persist();
    return { ...user };
  }

  async findUserByEmail(email) {
    const u = Object.values(this.data.users).find(x => x.email === email);
    return u ? { ...u } : null;
  }

  async getUser(id) {
    const u = this.data.users[id];
    return u ? { ...u } : null;
  }

  async updateUser(id, patch) {
    const u = this.data.users[id];
    if (!u) return null;
    Object.assign(u, patch);
    await this.persist();
    return { ...u };
  }

  async deleteUser(id) {
    const existed = !!this.data.users[id];
    delete this.data.users[id];
    for (const [k, s] of Object.entries(this.data.sessions)) if (s.userId === id) delete this.data.sessions[k];
    await this.persist();
    return existed;
  }

  async listUsers() {
    return Object.values(this.data.users)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(publicListUser);
  }

  async allUsersFull() {
    return Object.values(this.data.users).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(u => ({ ...u }));
  }

  async createSession(s) {
    this.data.sessions[s.tokenHash] = { userId: s.userId || null, role: s.role, expiresAt: s.expiresAt };
    await this.persist();
  }

  async getSession(tokenHash) {
    const s = this.data.sessions[tokenHash];
    if (!s) return null;
    if (Date.parse(s.expiresAt) <= Date.now()) {
      delete this.data.sessions[tokenHash];
      await this.persist();
      return null;
    }
    return { tokenHash, ...s };
  }

  async deleteSession(tokenHash) {
    if (this.data.sessions[tokenHash]) {
      delete this.data.sessions[tokenHash];
      await this.persist();
    }
  }

  async purgeExpiredSessions() {
    let n = 0;
    for (const [k, s] of Object.entries(this.data.sessions)) {
      if (Date.parse(s.expiresAt) <= Date.now()) { delete this.data.sessions[k]; n++; }
    }
    if (n) await this.persist();
  }
}

const COLS = {
  name: 'name', email: 'email', pinHash: 'pin_hash', pinSalt: 'pin_salt', failedAttempts: 'failed_attempts',
  lockedUntil: 'locked_until', answers: 'answers', step: 'step', status: 'status', photo: 'photo',
  consentAt: 'consent_at', updatedAt: 'updated_at', submittedAt: 'submitted_at'
};

function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, email: r.email, pinHash: r.pin_hash, pinSalt: r.pin_salt,
    failedAttempts: r.failed_attempts || 0, lockedUntil: iso(r.locked_until), answers: r.answers || {},
    step: r.step || 0, status: r.status || 'draft', photo: r.photo || null, hasPhoto: !!r.has_photo,
    consentAt: iso(r.consent_at), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), submittedAt: iso(r.submitted_at)
  };
}

const PROFILES = 'hub_onboarding_profiles';
const SESSIONS = 'hub_onboarding_sessions';
const LIST_COLS = 'id,name,email,answers,step,status,has_photo,created_at,updated_at,submitted_at';
const eq = v => encodeURIComponent(String(v));

// Talks to Supabase's REST API (PostgREST) with the service role key, like Sanctum's server does.
// The key never leaves the server. The tables have row level security with no policies and no grants
// for anon/authenticated, so only this key reaches them.
class SupabaseStore {
  constructor({ url, key, schema }) {
    this.base = url.replace(/\/+$/, '') + '/rest/v1';
    this.key = key;
    this.schema = schema;
    this.kind = 'supabase';
    this.warning = null;
  }

  async req(method, table, query, body, prefer) {
    const headers = { apikey: this.key, Accept: 'application/json' };
    // Legacy keys are JWTs and go in Authorization too; new sb_secret_ keys only go in apikey.
    if (!this.key.startsWith('sb_')) headers.Authorization = `Bearer ${this.key}`;
    if (method === 'GET') headers['Accept-Profile'] = this.schema;
    else { headers['Content-Profile'] = this.schema; headers['Content-Type'] = 'application/json'; }
    if (prefer) headers.Prefer = prefer;
    let res;
    try {
      res = await fetch(`${this.base}/${table}${query ? '?' + query : ''}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw Object.assign(new Error(`[supabase] ${method} ${table}: fikk ikke kontakt (${e.message})`), { status: 0 });
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || text || res.statusText;
      throw Object.assign(new Error(`[supabase] ${method} ${table}: ${res.status} ${msg}`), { status: res.status, code: data && data.code });
    }
    return data;
  }

  // Checks the connection at startup and says plainly what is wrong, without stopping the site.
  async init() {
    try {
      await this.req('GET', PROFILES, 'select=id&limit=1');
      this.warning = null;
    } catch (e) {
      let hint = 'Sjekk SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY.';
      if (e.status === 401 || e.status === 403) hint = 'Nøkkelen ble avvist. Bruk service role-nøkkelen (SUPABASE_SERVICE_ROLE_KEY), ikke anon-nøkkelen.';
      else if (e.code === 'PGRST106') hint = `Schemaet "${this.schema}" er ikke åpnet i Supabase sitt API.`;
      else if (e.code === 'PGRST205' || e.code === '42P01' || e.status === 404) hint = `Tabellene mangler i "${this.schema}". Kjør supabase/schema.sql i Supabase sin SQL Editor.`;
      this.warning = `Får ikke kontakt med databasen i Supabase. ${hint}`;
      console.error(`[store] ${e.message}\n[store] ${this.warning}`);
    }
  }

  async createUser(u) {
    try {
      const rows = await this.req('POST', PROFILES, 'select=*', {
        id: u.id, name: u.name, email: u.email, pin_hash: u.pinHash, pin_salt: u.pinSalt,
        answers: u.answers || {}, consent_at: u.consentAt || null
      }, 'return=representation');
      return rowToUser(rows[0]);
    } catch (e) {
      if (e.code === '23505') throw Object.assign(new Error('exists'), { code: 'EXISTS' });
      throw e;
    }
  }

  async findUserByEmail(email) {
    const rows = await this.req('GET', PROFILES, `select=*&email=eq.${eq(email)}&limit=1`);
    return rowToUser(rows[0]);
  }

  async getUser(id) {
    const rows = await this.req('GET', PROFILES, `select=*&id=eq.${eq(id)}&limit=1`);
    return rowToUser(rows[0]);
  }

  async updateUser(id, patch) {
    const body = {};
    for (const [key, value] of Object.entries(patch)) if (COLS[key]) body[COLS[key]] = value;
    if (!Object.keys(body).length) return this.getUser(id);
    const rows = await this.req('PATCH', PROFILES, `select=*&id=eq.${eq(id)}`, body, 'return=representation');
    return rowToUser(rows[0]);
  }

  async deleteUser(id) {
    const rows = await this.req('DELETE', PROFILES, `select=id&id=eq.${eq(id)}`, undefined, 'return=representation');
    return Array.isArray(rows) && rows.length > 0;
  }

  async listUsers() {
    const rows = await this.req('GET', PROFILES, `select=${LIST_COLS}&order=created_at.desc`);
    return rows.map(r => publicListUser(rowToUser(r)));
  }

  async allUsersFull() {
    const rows = await this.req('GET', PROFILES, 'select=*&order=created_at.desc');
    return rows.map(rowToUser);
  }

  async createSession(s) {
    await this.req('POST', SESSIONS, '', {
      token_hash: s.tokenHash, user_id: s.userId || null, role: s.role, expires_at: s.expiresAt
    }, 'return=minimal');
  }

  async getSession(tokenHash) {
    const rows = await this.req('GET', SESSIONS,
      `select=token_hash,user_id,role,expires_at&token_hash=eq.${eq(tokenHash)}&expires_at=gt.${eq(nowIso())}&limit=1`);
    const r = rows[0];
    return r ? { tokenHash: r.token_hash, userId: r.user_id, role: r.role, expiresAt: iso(r.expires_at) } : null;
  }

  async deleteSession(tokenHash) {
    await this.req('DELETE', SESSIONS, `token_hash=eq.${eq(tokenHash)}`, undefined, 'return=minimal');
  }

  async purgeExpiredSessions() {
    await this.req('DELETE', SESSIONS, `expires_at=lte.${eq(nowIso())}`, undefined, 'return=minimal');
  }
}

// The same secrets Sanctum uses on Replit. SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and the
// server-only SUPABASE_SERVICE_ROLE_KEY (or a new sb_secret_ key in SUPABASE_SECRET_KEY).
function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  const schema = (process.env.HUB_SCHEMA || 'tantric').trim().toLowerCase();
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error(`HUB_SCHEMA "${schema}" er ikke et gyldig navn.`);
  return url && key ? { url, key, schema } : null;
}

function createStore() {
  const cfg = supabaseConfig();
  if (cfg) return new SupabaseStore(cfg);
  const file = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'sanctum-hub.json');
  return new FileStore(file);
}

module.exports = { createStore, FileStore, SupabaseStore, supabaseConfig };
