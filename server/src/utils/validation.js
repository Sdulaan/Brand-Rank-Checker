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

const serpCheckSchema = z.object({
  brandId: mongoIdSchema,
  query: z.string().trim().optional(),
  country: supportedCountrySchema.optional(),
  isMobile: z.boolean().optional(),
});

const bulkDomainCheckSchema = z.object({
  domains: z.string().trim().min(1),
  minResults: z.coerce.number().int().min(1).max(100).optional(),
  country: supportedCountrySchema.optional(),
  isMobile: z.boolean().optional(),
});

module.exports = {
  mongoIdSchema,
  serpCheckSchema,
  bulkDomainCheckSchema,
};
