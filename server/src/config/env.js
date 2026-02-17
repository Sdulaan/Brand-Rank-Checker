const dotenv = require('dotenv');

dotenv.config();

const requiredVars = ['MONGO_URI'];

requiredVars.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

module.exports = {
  mongoUri: process.env.MONGO_URI,
  serperApiKeysRaw:
    process.env.SERPER_API_KEYS || process.env.SERPER_API_KEY || process.env.SERPAPI_KEY || '',
  serperMonthlyLimit: Number(process.env.SERPER_MONTHLY_LIMIT) || 2500,
  serperBaselineRemaining:
    process.env.SERPER_BASELINE_REMAINING !== undefined
      ? Number(process.env.SERPER_BASELINE_REMAINING)
      : null,
  serperBaselineKeyName: process.env.SERPER_BASELINE_KEY_NAME || '',
  port: Number(process.env.PORT) || 4000,
};
