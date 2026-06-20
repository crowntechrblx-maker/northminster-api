require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { json } = require('express');
const rateLimit = require('express-rate-limit');
const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers/resolvers');
const { initDb } = require('./models/db');
const { authMiddleware } = require('./middleware/auth');
const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();
  const apollo = new ApolloServer({ typeDefs, resolvers, formatError: (err) => { console.error('[GraphQL Error]', err.message); return { message: err.message }; } });
  await apollo.start();
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));
  app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));
  app.use(authMiddleware);
  app.use('/graphql', json(), expressMiddleware(apollo));
  app.post('/servers/heartbeat', json(), (req, res) => { console.log('[Heartbeat]', req.body?.jobId); res.json({ ok: true }); });
  app.listen(PORT, () => console.log('[API] Running on port ' + PORT));
}
start().catch((err) => { console.error('[FATAL]', err); process.exit(1); });