'use strict';
const fs = require('fs');
const path = require('path');

/*
 * Two stores with the same interface:
 *  - PgStore when DATABASE_URL is set (Supabase «sol», Replit's built-in PostgreSQL, Neon ...)
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

// Tables live in their own schema (default "sanctum_hub"), next to the other SOL schemas
// when the database is Supabase «sol», or alone in Replit's PostgreSQL.
const schemaSql = S => `
CREATE SCHEMA IF NOT EXISTS ${S};
CREATE TABLE IF NOT EXISTS ${S}.hub_users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  pin_hash        TEXT NOT NULL,
  pin_salt        TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  step            INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  photo           TEXT,
  consent_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at    TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS ${S}.hub_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES ${S}.hub_users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_sessions_user_idx ON ${S}.hub_sessions (user_id);
`;

// Keeps the tables away from Supabase's public API roles: row level security with no
// policies, and no grants for anon/authenticated. Only this server's own login reaches them.
const hardenSql = S => `
ALTER TABLE ${S}.hub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${S}.hub_sessions ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', '${S}', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', '${S}', r);
    END IF;
  END LOOP;
END $$;
`;

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

// Connection settings. Supabase's pooler uses its own certificate authority, so either paste the
// certificate from the Supabase dashboard into DATABASE_CA (verified), or set DATABASE_SSL=no-verify
// (encrypted, not verified). Either way sslmode is taken out of the URL so these settings apply.
function pgConfig(url) {
  const cfg = { connectionString: url, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 };
  const ca = (process.env.DATABASE_CA || '').trim();
  const mode = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (ca || mode === 'no-verify' || mode === 'require') {
    try {
      const u = new URL(url);
      ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'].forEach(k => u.searchParams.delete(k));
      cfg.connectionString = u.toString();
    } catch (e) { /* keep the URL as given */ }
    cfg.ssl = ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: mode !== 'no-verify' };
  }
  return cfg;
}

function schemaName() {
  const s = (process.env.DB_SCHEMA || 'sanctum_hub').trim().toLowerCase();
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(s)) throw new Error(`DB_SCHEMA "${s}" er ikke et gyldig navn (bruk små bokstaver, tall og _).`);
  return s;
}

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    this.schema = schemaName();
    this.U = `${this.schema}.hub_users`;
    this.S = `${this.schema}.hub_sessions`;
    this.pool = new Pool(pgConfig(url));
    this.pool.on('error', err => console.error('[store] postgres', err.message));
    this.kind = 'postgres';
  }

  async init() {
    await this.pool.query(schemaSql(this.schema));
    try {
      await this.pool.query(hardenSql(this.schema));
    } catch (e) {
      console.warn(`[store] kunne ikke stramme inn tilgangen til ${this.schema} (${e.message}). Sjekk at RLS er på i Supabase.`);
    }
  }

  q(sql, params) {
    return this.pool.query(sql, params);
  }

  async createUser(u) {
    try {
      const { rows } = await this.q(
        `INSERT INTO ${this.U} (id, name, email, pin_hash, pin_salt, answers, consent_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING *`,
        [u.id, u.name, u.email, u.pinHash, u.pinSalt, JSON.stringify(u.answers || {}), u.consentAt || null]
      );
      return rowToUser(rows[0]);
    } catch (e) {
      if (e.code === '23505') throw Object.assign(new Error('exists'), { code: 'EXISTS' });
      throw e;
    }
  }

  async findUserByEmail(email) {
    const { rows } = await this.q(`SELECT * FROM ${this.U} WHERE email = $1`, [email]);
    return rowToUser(rows[0]);
  }

  async getUser(id) {
    const { rows } = await this.q(`SELECT * FROM ${this.U} WHERE id = $1`, [id]);
    return rowToUser(rows[0]);
  }

  async updateUser(id, patch) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(patch)) {
      const col = COLS[key];
      if (!col) continue;
      params.push(key === 'answers' ? JSON.stringify(value || {}) : value);
      sets.push(`${col} = $${params.length}${key === 'answers' ? '::jsonb' : ''}`);
    }
    if (!sets.length) return this.getUser(id);
    params.push(id);
    const { rows } = await this.q(`UPDATE ${this.U} SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    return rowToUser(rows[0]);
  }

  async deleteUser(id) {
    const { rowCount } = await this.q(`DELETE FROM ${this.U} WHERE id = $1`, [id]);
    return rowCount > 0;
  }

  async listUsers() {
    const { rows } = await this.q(
      `SELECT id, name, email, answers, step, status, (photo IS NOT NULL) AS has_photo,
              created_at, updated_at, submitted_at
         FROM ${this.U} ORDER BY created_at DESC`
    );
    return rows.map(r => publicListUser(rowToUser(r)));
  }

  async allUsersFull() {
    const { rows } = await this.q(`SELECT * FROM ${this.U} ORDER BY created_at DESC`);
    return rows.map(rowToUser);
  }

  async createSession(s) {
    await this.q(`INSERT INTO ${this.S} (token_hash, user_id, role, expires_at) VALUES ($1, $2, $3, $4)`,
      [s.tokenHash, s.userId || null, s.role, s.expiresAt]);
  }

  async getSession(tokenHash) {
    const { rows } = await this.q(
      `SELECT token_hash, user_id, role, expires_at FROM ${this.S} WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash]
    );
    const r = rows[0];
    return r ? { tokenHash: r.token_hash, userId: r.user_id, role: r.role, expiresAt: iso(r.expires_at) } : null;
  }

  async deleteSession(tokenHash) {
    await this.q(`DELETE FROM ${this.S} WHERE token_hash = $1`, [tokenHash]);
  }

  async purgeExpiredSessions() {
    await this.q(`DELETE FROM ${this.S} WHERE expires_at <= now()`);
  }
}

function createStore() {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  const file = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'sanctum-hub.json');
  return new FileStore(file);
}

module.exports = { createStore, FileStore, PgStore, schemaSql, hardenSql, pgConfig };
