const express = require('express');
const cors = require('cors');
const createAuthController = require('./controllers/authController');
const brandRoutes = require('./routes/brandRoutes');
const domainRoutes = require('./routes/domainRoutes');
const createSerpRoutes = require('./routes/serpRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const createUserRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { createAuthMiddleware } = require('./middleware/auth');
const { USER_ROLES } = require('./models/User');
const scheduleRoutes = require('./routes/scheduleRoutes');

const createApp = ({ serpController, jwtSecret, jwtExpiresIn }) => {
  const app = express();
  const authMiddleware = createAuthMiddleware({ jwtSecret });
  const authController = createAuthController({ jwtSecret, jwtExpiresIn });

  app.use(cors({
    origin: [
      'https://url-rank-checker.vercel.app',
      'http://localhost:5173',
    ],
    credentials: true,
  }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', createAuthRoutes(authController, authMiddleware));
  app.use('/api/brands', authMiddleware.authenticate, brandRoutes);
  app.use('/api/domains', authMiddleware.authenticate, domainRoutes);
  app.use('/api/serp', authMiddleware.authenticate, createSerpRoutes(serpController));
  app.use(
    '/api/admin',
    authMiddleware.authenticate,
    authMiddleware.authorizeRoles(USER_ROLES.ADMIN),
    adminRoutes
  );
  app.use('/api/analytics', authMiddleware.authenticate, analyticsRoutes);
  app.use('/api/users', createUserRoutes(authMiddleware, USER_ROLES));
  app.use('/api/schedules', scheduleRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  return app;
};

module.exports = createApp;