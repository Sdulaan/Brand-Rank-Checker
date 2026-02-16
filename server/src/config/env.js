const dotenv = require('dotenv');

dotenv.config();

const requiredVars = ['MONGO_URI', 'SERPAPI_KEY'];

requiredVars.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

module.exports = {
  mongoUri: process.env.MONGO_URI,
  serpApiKey: process.env.SERPAPI_KEY,
  port: Number(process.env.PORT) || 4000,
};
