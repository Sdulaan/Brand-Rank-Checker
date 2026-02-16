const createApp = require('./app');
const connectDb = require('./config/db');
const env = require('./config/env');

const bootstrap = async () => {
  await connectDb(env.mongoUri);
  const app = createApp({ serpApiKey: env.serpApiKey });

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
