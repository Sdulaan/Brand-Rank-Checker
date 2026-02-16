const { z } = require('zod');

const mongoIdSchema = z.string().min(1);

const serpCheckSchema = z.object({
  brandId: mongoIdSchema,
  query: z.string().trim().optional(),
});

module.exports = {
  mongoIdSchema,
  serpCheckSchema,
};
