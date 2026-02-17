const express = require('express');
const cors = require('cors');
const brandRoutes = require('./routes/brandRoutes');
const domainRoutes = require('./routes/domainRoutes');
const createSerpRoutes = require('./routes/serpRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const createApp = ({ serpController }) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/brands', brandRoutes);
  app.use('/api/domains', domainRoutes);
  app.use('/api/serp', createSerpRoutes(serpController));
  app.use('/api/admin', adminRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  return app;
};

module.exports = createApp;
