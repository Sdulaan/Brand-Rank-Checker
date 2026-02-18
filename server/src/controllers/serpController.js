const { ZodError } = require('zod');
const { serpCheckSchema } = require('../utils/validation');

const createSerpController = ({ serpRunService }) => {
  const checkTopTen = async (req, res, next) => {
    try {
      const payload = serpCheckSchema.parse(req.body);
      const responsePayload = await serpRunService.runCheckForBrand({
        brandId: payload.brandId,
        query: payload.query,
        country: payload.country,
        isMobile: payload.isMobile,
        trigger: 'manual',
      });

      return res.json(responsePayload);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.flatten() });
      }

      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      if (error.response) {
        const status = error.response?.status || 502;
        return res.status(status === 200 ? 502 : status).json({
          error: 'Failed to fetch SERP data from Serper',
          details: error.response?.data || error.message,
        });
      }

      return next(error);
    }
  };

  return {
    checkTopTen,
  };
};

module.exports = createSerpController;
