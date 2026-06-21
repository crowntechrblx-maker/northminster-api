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

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (err) => {
      console.error('[GraphQL Error]', err.message);
      return { message: err.message, locations: err.locations, path: err.path };
    },
  });
  await apollo.start();

  const app = express();

  // Required for Render (and any reverse proxy) so express-rate-limit works correctly
  app.set('trust proxy', 1);

  app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

  // Health check (no auth)
  app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

  // Auth token stub - game server calls this in production to get a session token
  // In Studio mode BritSovAPI uses Key auth directly, so this only matters in live servers
  app.post('/auth/token', json(), (req, res) => {
    // For now return a dummy token; implement MessagingService flow when going live
    res.json({ token: process.env.MASTER_KEY, jobId: req.body && req.body.jobId });
  });

  // Auth middleware for all other routes
  app.use(authMiddleware);

  // GraphQL endpoint
  app.use('/graphql', json(), expressMiddleware(apollo));

  // Heartbeat endpoint
  app.post('/servers/heartbeat', json(), (req, res) => {
    console.log('[Heartbeat]', req.body && req.body.jobId);
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    console.log(`[API] Northminster API running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
