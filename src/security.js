'use strict';
const crypto = require('crypto');

// 6-digit PINs are hashed with scrypt and a per-profile salt. Brute force over
// the network is stopped by the per-profile lockout and the per-IP limits.
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(pin), salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pin, salt);
  return { hash: key.toString('hex'), salt: salt.toString('hex') };
}

async function verifyPin(pin, hashHex, saltHex) {
  if (!hashHex || !saltHex) return false;
  const key = await scrypt(pin, Buffer.from(saltHex, 'hex'));
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === key.length && crypto.timingSafeEqual(key, expected);
}

// Spends the same time as a real check, so unknown e-mails answer as slowly as known ones.
async function dummyVerify(pin) {
  await scrypt(pin, Buffer.alloc(16));
  return false;
}

const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Small in-memory fixed-window limiter, keyed by IP.
function limiter(max, windowMs) {
  const hits = new Map();
  return key => {
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset <= now) {
      e = { count: 0, reset: now + windowMs };
      hits.set(key, e);
    }
    e.count += 1;
    if (hits.size > 10000) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    }
    return e.count <= max;
  };
}

module.exports = { hashPin, verifyPin, dummyVerify, newToken, hashToken, safeEqual, limiter };
