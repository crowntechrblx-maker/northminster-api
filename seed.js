require('dotenv').config();
const { pool, initDb } = require('./src/models/db');
const { addKey } = require('./src/middleware/auth');
const crypto = require('crypto');
async function seed() {
  await initDb();
  const key = crypto.randomBytes(32).toString('hex');
  await addKey(key, 'game-server');
  console.log('\n========================================');
  console.log('  NEW API KEY: ' + key);
  console.log('  Store in Roblox DataStore key: NorthminsterApiKey');
  console.log('========================================\n');
  await pool.end();
}
seed().catch(console.error);