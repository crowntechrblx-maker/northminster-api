const { pool } = require('../models/db');
const crypto = require('crypto');
const keyCache = new Set();
let cacheFilled = false;
async function fillCache() { const { rows } = await pool.query('SELECT key_hash FROM server_keys'); for (const r of rows) keyCache.add(r.key_hash); cacheFilled = true; }
function hashKey(key) { return crypto.createHash('sha256').update(key).digest('hex'); }
async function authMiddleware(req, res, next) {
  if (req.path === '/health') return next();
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const match = auth.match(/^Key\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Invalid format. Expected: Key <value>' });
  const rawKey = match[1].trim();
  if (process.env.MASTER_KEY && rawKey === process.env.MASTER_KEY) return next();
  if (!cacheFilled) await fillCache();
  const hash = hashKey(rawKey);
  if (keyCache.has(hash)) return next();
  const { rows } = await pool.query('SELECT id FROM server_keys WHERE key_hash = $1', [hash]);
  if (rows.length > 0) { keyCache.add(hash); return next(); }
  return res.status(401).json({ error: 'Invalid API key' });
}
async function addKey(rawKey, label) {
  const hash = hashKey(rawKey);
  await pool.query('INSERT INTO server_keys (key_hash, label) VALUES ($1, $2) ON CONFLICT DO NOTHING', [hash, label || null]);
  keyCache.add(hash);
}
module.exports = { authMiddleware, addKey, hashKey };