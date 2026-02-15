const express = require('express');
const cors = require('cors');

const brandRoutes = require('./routes/brands');
const serpRoutes = require('./routes/serp');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp(env) {
  const app = express();

  app.locals.env = env;

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/brands', brandRoutes);
  app.use('/api/serp', serpRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
