require('dotenv').config();

const { loadEnv } = require('./config/env');
const { connectDatabase } = require('./config/db');
const { createApp } = require('./app');

async function startServer() {
  try {
    const env = loadEnv();
    await connectDatabase(env.MONGODB_URI);

    const app = createApp(env);

    app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
