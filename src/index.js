require('dotenv').config();

const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { json } = require('express');
const rateLimit = require('express-rate-limit');
const http = require('http');
const https = require('https');

const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers/resolvers');
const { initDb, pool } = require('./models/db');
const { authMiddleware } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || ('http://localhost:' + PORT);

// Keep-alive ping every 4 minutes to prevent Render free tier spin-down
function startKeepAlive() {
  setInterval(function() {
    const url = SELF_URL + '/health';
    const client = url.startsWith('https') ? https : http;
    client.get(url, function(res) {
      console.log('[KeepAlive] ping ' + res.statusCode);
    }).on('error', function(e) {
      console.warn('[KeepAlive] error:', e.message);
    });
  }, 4 * 60 * 1000);
}

async function start() {
  await initDb();

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    // BloxQL (the Roblox client) bundles multiple operations into a single
    // HTTP request as a JSON array. Apollo rejects batched requests by default
    // ("Operation batching disabled."), so enable them here.
    allowBatchedHttpRequests: true,
    formatError: function(err) {
      console.error('[GraphQL Error]', err.message);
      return { message: err.message, locations: err.locations, path: err.path };
    },
  });
  await apollo.start();

  const app = express();

  app.set('trust proxy', 1);

  app.use(rateLimit({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false }));

  // Public landing page - no auth required
  app.get('/', async function(req, res) {
    var dbStatus = 'ok';
    try { await pool.query('SELECT 1'); } catch(e) { dbStatus = 'error'; }
    var html = [
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>Northminster API</title>',
      '<style>',
      '*{box-sizing:border-box;margin:0;padding:0}',
      'body{background:#0f0f0f;color:#e0e0e0;font-family:system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}',
      'h1{font-size:2rem;font-weight:700;letter-spacing:-.03em;margin-bottom:.25rem}',
      'p.sub{color:#888;margin-bottom:2.5rem;font-size:.9rem}',
      '.cards{display:flex;gap:1rem;flex-wrap:wrap;justify-content:center}',
      '.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:1.25rem 1.75rem;min-width:180px;text-align:center}',
      '.card .label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:.5rem}',
      '.card .value{font-size:1.1rem;font-weight:600}',
      '.ok{color:#4ade80}.error{color:#f87171}',
      '.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}',
      '.dot.ok{background:#4ade80;box-shadow:0 0 6px #4ade80}',
      '.dot.error{background:#f87171}',
      'footer{margin-top:3rem;color:#444;font-size:.8rem}',
      '</style></head><body>',
      '<h1>Northminster API</h1>',
      '<p class="sub">Game backend service</p>',
      '<div class="cards">',
      '<div class="card"><div class="label">API</div><div class="value"><span class="dot ok"></span><span class="ok">Online</span></div></div>',
      '<div class="card"><div class="label">Database</div><div class="value"><span class="dot ' + dbStatus + '"></span><span class="' + dbStatus + '">' + (dbStatus === 'ok' ? 'Connected' : 'Error') + '</span></div></div>',
      '<div class="card"><div class="label">Uptime</div><div class="value">' + Math.floor(process.uptime()) + 's</div></div>',
      '<div class="card"><div class="label">GraphQL</div><div class="value"><span class="dot ok"></span><span class="ok">/graphql</span></div></div>',
      '</div>',
      '<footer>Northminster &mdash; ' + new Date().toUTCString() + '</footer>',
      '</body></html>'
    ].join('');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // Health check - no auth
  app.get('/health', function(req, res) {
    res.json({ status: 'ok', ts: Date.now() });
  });

  // Auth token endpoint
  app.post('/auth/token', json(), authMiddleware, function(req, res) {
    res.json({ token: process.env.MASTER_KEY, jobId: req.body ? req.body.jobId : null });
  });

  // All routes below require auth
  app.use(authMiddleware);

  app.use('/graphql', json(), expressMiddleware(apollo));

  app.post('/servers/heartbeat', json(), function(req, res) {
    console.log('[Heartbeat]', req.body ? req.body.jobId : '');
    res.json({ ok: true });
  });

  app.listen(PORT, function() {
    console.log('[API] Northminster API running on port ' + PORT);
    startKeepAlive();
  });
}

start().catch(function(err) {
  console.error('[FATAL]', err);
  process.exit(1);
});
