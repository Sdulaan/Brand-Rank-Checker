const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');
const connectDb = require('./config/db');
const env = require('./config/env');
const createSerpController = require('./controllers/serpController');
const { InMemoryCache } = require('./services/cacheService');
const { parseEnvKeys, ensureSettings, applyBaselineFromEnv } = require('./services/adminSettingsService');
const { createKeyRotationService } = require('./services/keyRotationService');
const { createSerpRunService } = require('./services/serpRunService');
const { ensureInitialAdmin } = require('./services/userBootstrapService');
const scheduler = require('./services/schedulerService'); // ← replaces autoCheckScheduler

const bootstrap = async () => {
  await connectDb(env.mongoUri);

  const envKeys = parseEnvKeys(env.serperApiKeysRaw);
  await ensureSettings({ envKeys });
  await applyBaselineFromEnv({
    baselineRemaining: env.serperBaselineRemaining,
    baselineKeyName: env.serperBaselineKeyName,
  });
  await ensureInitialAdmin({
    email: env.initialAdminEmail,
    username: env.initialAdminUsername,
    password: env.initialAdminPassword,
  });

  const cache = new InMemoryCache();
  const keyRotationService = createKeyRotationService();
  const serpRunService = createSerpRunService({ cache, keyRotationService });
  const serpController = createSerpController({ serpRunService });

  const app = createApp({
    serpController,
    jwtSecret: env.jwtSecret,
    jwtExpiresIn: env.jwtExpiresIn,
  });
  app.locals.serpRunService = serpRunService;
  app.locals.serperMonthlyLimit = env.serperMonthlyLimit;

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const emitAdminUpdate = (payload = {}) => {
    io.emit('admin:dashboard-updated', { at: new Date().toISOString(), ...payload });
  };
  app.locals.emitAdminUpdate = emitAdminUpdate;

  // ── Init schedulerService with serpRunService + socket.io status push ──────
  scheduler.init({
    serpRunService,
    onStatusChange: () => emitAdminUpdate({ source: 'scheduler' }),
  });
  scheduler.restoreSchedules();

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});