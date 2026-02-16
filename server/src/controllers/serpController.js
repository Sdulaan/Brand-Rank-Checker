const { ZodError } = require('zod');
const Brand = require('../models/Brand');
const Domain = require('../models/Domain');
const { serpCheckSchema } = require('../utils/validation');
const { extractHostFromLink } = require('../utils/domain');
const { fetchSerpResults, buildLookup, classifyResult } = require('../services/serpService');

const createSerpController = ({ apiKey, cache }) => {
  const checkTopTen = async (req, res, next) => {
    try {
      const payload = serpCheckSchema.parse(req.body);
      const brand = await Brand.findById(payload.brandId);

      if (!brand || !brand.isActive) {
        return res.status(404).json({ error: 'Active brand not found' });
      }

      const query = payload.query?.trim() || brand.code || brand.name;
      const cacheKey = `${brand._id.toString()}::${query}::id::id`;
      const cached = cache.get(cacheKey);

      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      let serpData;
      try {
        serpData = await fetchSerpResults({
          apiKey,
          query,
          gl: 'id',
          hl: 'id',
          num: 10,
        });
      } catch (error) {
        const status = error.response?.status || 502;
        return res.status(status === 200 ? 502 : status).json({
          error: 'Failed to fetch SERP data from SerpApi',
          details: error.response?.data || error.message,
        });
      }

      const organicResults = (serpData.organic_results || []).slice(0, 10);
      const activeDomains = await Domain.find({ isActive: true }).populate('brand', 'code name color isActive');
      const lookup = buildLookup(activeDomains);

      const results = organicResults.map((item, index) => {
        const link = item.link || item.redirect_link || '';
        const domainHost = extractHostFromLink(link);
        const { matchedDomain, matchType } = classifyResult(domainHost, link, lookup);

        const matchedBrand = matchedDomain?.brand
          ? {
              _id: matchedDomain.brand._id,
              code: matchedDomain.brand.code,
              name: matchedDomain.brand.name,
              color: matchedDomain.brand.color,
            }
          : null;

        const badge = !matchedBrand
          ? 'UNKNOWN'
          : matchedBrand._id.toString() === brand._id.toString()
            ? 'OWN'
            : 'COMPETITOR';

        return {
          rank: index + 1,
          title: item.title || '(No title)',
          link,
          domainHost,
          badge,
          matchType,
          matchedBrand,
          matchedDomain: matchedDomain
            ? {
                _id: matchedDomain._id,
                domain: matchedDomain.domain,
                domainHostKey: matchedDomain.domainHostKey,
                domainRootKey: matchedDomain.domainRootKey,
              }
            : null,
        };
      });

      const responsePayload = {
        brand: {
          _id: brand._id,
          code: brand.code,
          name: brand.name,
          color: brand.color,
        },
        query,
        params: { gl: 'id', hl: 'id', num: 10 },
        checkedAt: new Date().toISOString(),
        results,
      };

      // Future persistence stubs (MVP skips saving):
      // await SerpCheck.create({ brand: brand._id, query, gl: 'id', hl: 'id', checkedAt: new Date() });
      // await SerpResult.insertMany(results.map((r) => ({ serpCheckId, ...r })));

      cache.set(cacheKey, responsePayload);
      return res.json(responsePayload);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.flatten() });
      }
      return next(error);
    }
  };

  return {
    checkTopTen,
  };
};

module.exports = createSerpController;
