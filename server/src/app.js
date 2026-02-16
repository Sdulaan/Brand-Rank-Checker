const express = require('express');
const cors = require('cors');
const brandRoutes = require('./routes/brandRoutes');
const domainRoutes = require('./routes/domainRoutes');
const createSerpRoutes = require('./routes/serpRoutes');
const createSerpController = require('./controllers/serpController');
const { InMemoryCache } = require('./services/cacheService');

const createApp = ({ serpApiKey }) => {
  const app = express();
  const cache = new InMemoryCache();
  const serpController = createSerpController({ apiKey: serpApiKey, cache });

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/brands', brandRoutes);
  app.use('/api/domains', domainRoutes);
  app.use('/api/serp', createSerpRoutes(serpController));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  return app;
};

module.exports = createApp;
