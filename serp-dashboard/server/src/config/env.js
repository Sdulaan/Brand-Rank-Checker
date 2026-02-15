const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('5000').transform((value) => Number(value)),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  GOOGLE_API_KEY: z.string().min(1, 'GOOGLE_API_KEY is required'),
  GOOGLE_CSE_CX: z.string().min(1, 'GOOGLE_CSE_CX is required')
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = parsed.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return parsed.data;
}

module.exports = { loadEnv };
