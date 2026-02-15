const express = require('express');
const { z } = require('zod');
const Brand = require('../models/Brand');
const Domain = require('../models/Domain');
const { extractHostname, normalizeDomain } = require('../utils/domain');
const { fetchTopTenGoogleResults } = require('../services/googleSearch');

const CACHE_TTL_MS = 2 * 60 * 1000;
const responseCache = new Map();

const router = express.Router();

const serpSchema = z.object({
  brandId: z.string().min(1),
  query: z.string().trim().optional()
});

function createCacheKey({ brandId, query, gl, hl }) {
  return `${brandId}|${query.toLowerCase()}|${gl}|${hl}`;
}

function getCached(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCached(key, value) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

router.post('/check', async (req, res, next) => {
  try {
    const parsed = serpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: parsed.error.flatten()
      });
    }

    const { brandId, query: rawQuery } = parsed.data;
    const selectedBrand = await Brand.findById(brandId).lean();

    if (!selectedBrand || !selectedBrand.isActive) {
      return res.status(404).json({ message: 'Brand not found or inactive' });
    }

    const query = rawQuery?.trim() || selectedBrand.code;
    const gl = 'id';
    const hl = 'id';

    const cacheKey = createCacheKey({ brandId, query, gl, hl });
    const cachedResponse = getCached(cacheKey);
    if (cachedResponse) {
      return res.json({ ...cachedResponse, cached: true });
    }

    const [googleResponse, domains] = await Promise.all([
      fetchTopTenGoogleResults({
        apiKey: req.app.locals.env.GOOGLE_API_KEY,
        cx: req.app.locals.env.GOOGLE_CSE_CX,
        query,
        gl,
        hl
      }),
      Domain.find({ isActive: true }).populate('brand').lean()
    ]);

    const domainMap = new Map();

    for (const domainRecord of domains) {
      if (domainRecord.brand?.isActive) {
        domainMap.set(domainRecord.domainKey, {
          brandId: String(domainRecord.brand._id),
          code: domainRecord.brand.code,
          color: domainRecord.brand.color
        });
      }
    }

    const results = googleResponse.items.slice(0, 10).map((item, index) => {
      const hostname = extractHostname(item.link);
      const domainKey = normalizeDomain(hostname);
      const domainMatch = domainKey ? domainMap.get(domainKey) : null;

      let badge = { type: 'UNKNOWN' };

      if (domainMatch) {
        if (domainMatch.brandId === brandId) {
          badge = {
            type: 'OWN',
            brand: {
              id: domainMatch.brandId,
              code: domainMatch.code,
              color: domainMatch.color
            }
          };
        } else {
          badge = {
            type: 'COMPETITOR',
            brand: {
              id: domainMatch.brandId,
              code: domainMatch.code,
              color: domainMatch.color
            }
          };
        }
      }

      return {
        rank: index + 1,
        title: item.title,
        link: item.link,
        hostname,
        domainKey,
        badge
      };
    });

    const payload = {
      brand: {
        id: String(selectedBrand._id),
        code: selectedBrand.code,
        name: selectedBrand.name,
        color: selectedBrand.color
      },
      query,
      params: {
        gl,
        hl,
        num: 10
      },
      results
    };

    setCached(cacheKey, payload);

    res.json({ ...payload, cached: false });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
