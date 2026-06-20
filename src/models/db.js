const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await client.query(`CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW(), roblox TEXT NOT NULL UNIQUE, cash NUMERIC NOT NULL DEFAULT 0)`);
    await client.query(`CREATE TABLE IF NOT EXISTS organisations (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW(), name TEXT NOT NULL UNIQUE, group_id TEXT, discoverable BOOLEAN NOT NULL DEFAULT TRUE, type TEXT NOT NULL DEFAULT 'civilian', tag TEXT, custom_permissions JSONB NOT NULL DEFAULT '[]', role_set JSONB NOT NULL DEFAULT '[]')`);
    await client.query(`CREATE TABLE IF NOT EXISTS bank_accounts (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW(), balance NUMERIC NOT NULL DEFAULT 0, player_id TEXT REFERENCES players(id) ON DELETE CASCADE, organisation_id TEXT REFERENCES organisations(id) ON DELETE CASCADE)`);
    await client.query(`CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW(), player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, suspended_until TIMESTAMPTZ, has_theory BOOLEAN NOT NULL DEFAULT FALSE, categories JSONB NOT NULL DEFAULT '[]')`);
    await client.query(`CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW(), location TEXT NOT NULL, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE)`);
    await client.query(`CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW(), number_plate TEXT NOT NULL UNIQUE, colour TEXT NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL, year INT NOT NULL, inventory JSONB NOT NULL DEFAULT '[]', player_id TEXT REFERENCES players(id) ON DELETE SET NULL, org_id TEXT REFERENCES organisations(id) ON DELETE SET NULL, property_id TEXT REFERENCES properties(id) ON DELETE SET NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, name TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual')`);
    await client.query(`CREATE TABLE IF NOT EXISTS server_keys (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, key_hash TEXT NOT NULL UNIQUE, label TEXT, created TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    console.log('[DB] Schema initialised');
  } finally { client.release(); }
}
module.exports = { pool, initDb };