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

  // Required for Render reverse proxy so express-rate-limit works
  app.set('trust proxy', 1);

  app.use(rateLimit({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false }));

  app.get('/health', function(req, res) { res.json({ status: 'ok', ts: Date.now() }); });

  // Auth token endpoint - used by game servers in production
  app.post('/auth/token', json(), function(req, res) {
    res.json({ token: process.env.MASTER_KEY, jobId: req.body ? req.body.jobId : null });
  });

  app.use(authMiddleware);

  app.use('/graphql', json(), expressMiddleware(apollo));

  app.post('/servers/heartbeat', json(), function(req, res) {
    console.log('[Heartbeat]', req.body ? req.body.jobId : '');
    res.json({ ok: true });
  });

  app.listen(PORT, function() {
    console.log('[API] Northminster API running on port ' + PORT);
  });
}

start().catch(function(err) {
  console.error('[FATAL]', err);
  process.exit(1);
});