const Brand = require('../models/Brand');
const Domain = require('../models/Domain');
const SerpRun = require('../models/SerpRun');
const { extractHostFromLink } = require('../utils/domain');
const { fetchSerpResults, buildLookup, classifyResult } = require('./serpService');

const buildResponsePayload = ({
  brand,
  query,
  checkedAt,
  params,
  results,
  keyId = null,
  keyName = '',
  keyRemaining = null,
}) => ({
  brand: {
    _id: brand._id,
    code: brand.code,
    name: brand.name,
    color: brand.color,
  },
  query,
  params,
  checkedAt,
  keyId,
  keyName,
  keyRemaining,
  results,
});

const summarizeResults = (results) => {
  const ownRows = results.filter((item) => item.badge === 'OWN');

  return {
    ownCount: ownRows.length,
    competitorCount: results.filter((item) => item.badge === 'COMPETITOR').length,
    unknownCount: results.filter((item) => item.badge === 'UNKNOWN').length,
    bestOwnRank: ownRows.length ? Math.min(...ownRows.map((item) => item.rank)) : null,
  };
};

const createSerpRunService = ({ cache, keyRotationService }) => {
  const runCheckForBrand = async ({
    brandId,
    query,
    country = 'id',
    isMobile = false,
    trigger = 'manual',
    skipCache = false,
  }) => {
    const brand = await Brand.findById(brandId);
    if (!brand || !brand.isActive) {
      const error = new Error('Active brand not found');
      error.statusCode = 404;
      throw error;
    }

    const queryValue = query?.trim() || brand.code || brand.name;
    const countryCode = (country || 'id').toLowerCase();
    const params = { gl: countryCode, hl: 'id', num: 10, device: isMobile ? 'mobile' : 'desktop' };
    const cacheKey = `${brand._id.toString()}::${queryValue}::${params.gl}::${params.hl}::${params.device}`;

    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const { data: serpData, keyId, keyName, keyRemaining } = await keyRotationService.withRotatingKey(({ key }) =>
      fetchSerpResults({ apiKey: key, query: queryValue, ...params })
    );

    const organicResults = (serpData.organic || []).slice(0, 10);
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
        snippet: item.snippet || '',
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
              domainPathPrefix: matchedDomain.domainPathPrefix || '',
            }
          : null,
      };
    });

    const checkedAt = new Date().toISOString();
    const summary = summarizeResults(results);

    const payload = buildResponsePayload({
      brand,
      query: queryValue,
      checkedAt,
      params,
      results,
      keyId,
      keyName,
      keyRemaining,
    });

    if (trigger === 'auto') {
      await SerpRun.create({
        brand: brand._id,
        query: queryValue,
        trigger,
        checkedAt: new Date(checkedAt),
        params,
        keyId,
        keyName,
        keyRemaining,
        ...summary,
        results,
      });
    }

    cache.set(cacheKey, payload);
    return payload;
  };

  const runAutoCheckForAllBrands = async ({ shouldStop, onProgress } = {}) => {
    const brands = await Brand.find({ isActive: true }).sort({ code: 1 });
    const outcomes = [];
    let stopped = false;
    const totalBrands = brands.length;
    let processedBrands = 0;

    for (const brand of brands) {
      if (shouldStop?.()) {
        stopped = true;
        break;
      }

      try {
        const payload = await runCheckForBrand({
          brandId: brand._id,
          query: brand.code || brand.name,
          trigger: 'auto',
          skipCache: true,
        });
        outcomes.push({ brandId: brand._id, brandCode: brand.code, ok: true, checkedAt: payload.checkedAt });
      } catch (error) {
        outcomes.push({ brandId: brand._id, brandCode: brand.code, ok: false, error: error.message });
      }

      processedBrands += 1;
      onProgress?.({ processedBrands, totalBrands, brandCode: brand.code });
    }

    return { outcomes, stopped };
  };

  return {
    runCheckForBrand,
    runAutoCheckForAllBrands,
  };
};

module.exports = {
  createSerpRunService,
};
