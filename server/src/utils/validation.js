const { z } = require('zod');

const mongoIdSchema = z.string().min(1);
const supportedCountrySchema = z.enum([
  'id',
  'us',
  'in',
  'sg',
  'my',
  'th',
  'vn',
  'ph',
  'au',
  'gb',
  'ca',
  'de',
  'fr',
  'jp',
  'kr',
  'cn',
  'sa',
  'ae',
  'tr',
  'br',
  'ru',
  'za',
]);
const supportedLanguageSchema = z.enum(['id', 'en', 'hi', 'th', 'vi', 'ja', 'ko', 'zh-CN']);

const serpCheckSchema = z.object({
  brandId: mongoIdSchema,
  query: z.string().trim().optional(),
  country: supportedCountrySchema.optional(),
  language: supportedLanguageSchema.optional(),
});

module.exports = {
  mongoIdSchema,
  serpCheckSchema,
};
