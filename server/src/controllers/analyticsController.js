const Brand = require('../models/Brand');
const Domain = require('../models/Domain');
const SerpRun = require('../models/SerpRun');

const RANGE_TO_DAYS = {
  '1d': 1,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

const computeTrend = (firstRank, lastRank) => {
  if (firstRank === null || lastRank === null) {
    return { trend: 'no_data', delta: null };
  }

  const delta = firstRank - lastRank;
  if (delta > 0) return { trend: 'up', delta };
  if (delta < 0) return { trend: 'down', delta };
  return { trend: 'stable', delta: 0 };
};

const getRankingHistory = async (req, res, next) => {
  try {
    const brandId = req.params.brandId;
    const range = req.query.range || '7d';
    const days = RANGE_TO_DAYS[range];

    if (!days) {
      return res.status(400).json({ error: 'range must be one of 1d, 7d, 14d, 30d' });
    }

    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const brandDomains = await Domain.find({ brand: brandId, isActive: true })
      .select('domain')
      .sort({ domain: 1 });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const runs = await SerpRun.find({ brand: brandId, checkedAt: { $gte: since } })
      .sort({ checkedAt: 1 })
      .select('checkedAt bestOwnRank ownCount competitorCount unknownCount query trigger results');

    const points = runs.map((run) => ({
      checkedAt: run.checkedAt,
      bestOwnRank: run.bestOwnRank,
      ownCount: run.ownCount,
      competitorCount: run.competitorCount,
      unknownCount: run.unknownCount,
      query: run.query,
      trigger: run.trigger,
    }));

    const rankedPoints = points.filter((item) => item.bestOwnRank !== null);
    const firstOverall = rankedPoints[0] || null;
    const lastOverall = rankedPoints[rankedPoints.length - 1] || null;
    const overallTrend = computeTrend(firstOverall?.bestOwnRank ?? null, lastOverall?.bestOwnRank ?? null);

    const domainTrends = brandDomains.map((domainItem) => {
      const perRunPoints = runs.map((run) => {
        const rankMatches = (run.results || [])
          .filter(
            (row) =>
              row.badge === 'OWN' &&
              row.matchedDomain?._id &&
              row.matchedDomain._id.toString() === domainItem._id.toString()
          )
          .map((row) => row.rank);

        const bestRankForRun = rankMatches.length ? Math.min(...rankMatches) : null;
        return {
          checkedAt: run.checkedAt,
          rank: bestRankForRun,
        };
      });

      const rankedDomainPoints = perRunPoints.filter((item) => item.rank !== null);
      const first = rankedDomainPoints[0]?.rank ?? null;
      const last = rankedDomainPoints[rankedDomainPoints.length - 1]?.rank ?? null;
      const prev = rankedDomainPoints.length > 1 ? rankedDomainPoints[rankedDomainPoints.length - 2].rank : null;
      const movement = computeTrend(first, last);

      return {
        domain: domainItem.domain,
        domainHostKey: domainItem._id.toString(),
        trend: movement.trend,
        delta: movement.delta,
        currentRank: last,
        previousRank: prev,
        points: perRunPoints,
      };
    });

    return res.json({
      brand: {
        _id: brand._id,
        code: brand.code,
        name: brand.name,
        color: brand.color,
      },
      range,
      from: since,
      to: new Date(),
      trend: overallTrend.trend,
      delta: overallTrend.delta,
      points,
      domainTrends,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRankingHistory,
};
