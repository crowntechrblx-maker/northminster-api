const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        roblox TEXT NOT NULL UNIQUE,
        cash NUMERIC NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS organisations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name TEXT NOT NULL UNIQUE,
        group_id TEXT,
        discoverable BOOLEAN NOT NULL DEFAULT TRUE,
        type TEXT NOT NULL DEFAULT 'civilian',
        tag TEXT,
        custom_permissions JSONB NOT NULL DEFAULT '[]',
        role_set JSONB NOT NULL DEFAULT '[]'
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        balance NUMERIC NOT NULL DEFAULT 0,
        player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
        organisation_id TEXT REFERENCES organisations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS licenses (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        player_id TEXT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
        suspended_until TIMESTAMPTZ,
        has_theory BOOLEAN NOT NULL DEFAULT FALSE,
        categories JSONB NOT NULL DEFAULT '[]',
        endorsements JSONB NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        location TEXT NOT NULL,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        number_plate TEXT NOT NULL UNIQUE,
        colour TEXT NOT NULL,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INT NOT NULL,
        inventory JSONB NOT NULL DEFAULT '[]',
        player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
        org_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
        property_id TEXT REFERENCES properties(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual'
      );

      CREATE TABLE IF NOT EXISTS flags (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires TIMESTAMPTZ,
        reason TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        player_subject TEXT REFERENCES players(id) ON DELETE CASCADE,
        vehicle_subject TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
        issuer_id TEXT REFERENCES players(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS markers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason TEXT NOT NULL,
        vehicle_subject TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
        issuer_id TEXT REFERENCES players(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        type TEXT NOT NULL,
        issuer_id TEXT REFERENCES players(id) ON DELETE SET NULL,
        subject_id TEXT REFERENCES players(id) ON DELETE CASCADE,
        charges JSONB NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        type TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        from_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
        to_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS cmdr_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        executor TEXT,
        command TEXT,
        args JSONB NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS server_keys (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        key_hash TEXT NOT NULL UNIQUE,
        label TEXT,
        created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // --- Column reconciliation ---
    // CREATE TABLE IF NOT EXISTS never alters a table that already exists, so any
    // column added to the schema after a table was first created must be backfilled
    // explicitly. These statements are all idempotent and safe to run on every boot.
    await client.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS cash NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS group_id TEXT;
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'civilian';
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tag TEXT;
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS custom_permissions JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS role_set JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS organisation_id TEXT REFERENCES organisations(id) ON DELETE CASCADE;
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS has_theory BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS endorsements JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '[]';
    `);

    console.log('[DB] Schema initialised');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
