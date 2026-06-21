require('dotenv').config();
const { pool, initDb } = require('./src/models/db');

async function migrate() {
  await initDb();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS flags (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires         TIMESTAMPTZ,
        reason          TEXT NOT NULL,
        active          BOOLEAN NOT NULL DEFAULT TRUE,
        player_subject  TEXT REFERENCES players(id) ON DELETE CASCADE,
        vehicle_subject TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
        issuer_id       TEXT REFERENCES players(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS markers (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason          TEXT NOT NULL,
        vehicle_subject TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
        issuer_id       TEXT REFERENCES players(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS records (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        type       TEXT NOT NULL,
        issuer_id  TEXT REFERENCES players(id) ON DELETE SET NULL,
        subject_id TEXT REFERENCES players(id) ON DELETE CASCADE,
        charges    JSONB NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        type       TEXT NOT NULL,
        amount     NUMERIC NOT NULL,
        from_id    TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
        to_id      TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS cmdr_logs (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        executor   TEXT,
        command    TEXT,
        args       JSONB NOT NULL DEFAULT '[]'
      );
    `);
    console.log('Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}
migrate().catch(console.error);