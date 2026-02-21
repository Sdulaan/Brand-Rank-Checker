const SerpRun = require('../models/SerpRun');
const { ensureSettings, getSanitizedSettings } = require('../services/adminSettingsService');
const scheduler = require('../services/schedulerService'); // ← replaces autoCheckScheduler

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const MIN_INTERVAL_HOURS = 5 / 60;
const notifyAdminUpdate = (req, payload = {}) => req.app.locals.emitAdminUpdate?.(payload);

const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await ensureSettings();
    return res.json(getSanitizedSettings(settings));
  } catch (error) {
    return next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const settings = await ensureSettings();
    const enabled = req.body.autoCheckEnabled;
    const intervalHours = toNumber(req.body.checkIntervalHours);

    if (typeof enabled === 'boolean') {
      settings.autoCheckEnabled = enabled;
      if (enabled && !settings.nextAutoCheckAt) {
        settings.nextAutoCheckAt = new Date(Date.now() + (settings.checkIntervalHours || 1) * 60 * 60 * 1000);
      }
      if (!enabled) {
        settings.nextAutoCheckAt = null;
      }
    }

    if (intervalHours !== null) {
      if (intervalHours < MIN_INTERVAL_HOURS || intervalHours > 24) {
        return res.status(400).json({ error: 'checkIntervalHours must be between 5 minutes and 24 hours' });
      }
      settings.checkIntervalHours = intervalHours;
      if (settings.autoCheckEnabled) {
        settings.nextAutoCheckAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
      }
    }

    await settings.save();
    notifyAdminUpdate(req, { source: 'schedule-update' });
    return res.json(getSanitizedSettings(settings));
  } catch (error) {
    return next(error);
  }
};

const addApiKey = async (req, res, next) => {
  try {
    const { name, key, isActive } = req.body;
    if (!name?.trim() || !key?.trim()) {
      return res.status(400).json({ error: 'name and key are required' });
    }

    const settings = await ensureSettings();
    settings.serpApiKeys.push({
      name: name.trim(),
      key: key.trim(),
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    await settings.save();
    notifyAdminUpdate(req, { source: 'api-key-add' });
    return res.status(201).json(getSanitizedSettings(settings));
  } catch (error) {
    return next(error);
  }
};

const updateApiKey = async (req, res, next) => {
  try {
    const settings = await ensureSettings();
    const item = settings.serpApiKeys.id(req.params.keyId);
    if (!item) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const { name, key, isActive } = req.body;
    if (typeof name === 'string' && name.trim()) {
      item.name = name.trim();
    }
    if (typeof key === 'string' && key.trim()) {
      item.key = key.trim();
    }
    if (typeof isActive === 'boolean') {
      item.isActive = isActive;
    }

    await settings.save();
    notifyAdminUpdate(req, { source: 'api-key-update' });
    return res.json(getSanitizedSettings(settings));
  } catch (error) {
    return next(error);
  }
};

const deleteApiKey = async (req, res, next) => {
  try {
    const settings = await ensureSettings();
    const item = settings.serpApiKeys.id(req.params.keyId);
    if (!item) {
      return res.status(404).json({ error: 'API key not found' });
    }

    item.deleteOne();
    await settings.save();
    notifyAdminUpdate(req, { source: 'api-key-delete' });

    return res.json(getSanitizedSettings(settings));
  } catch (error) {
    return next(error);
  }
};

const getAdminDashboard = async (req, res, next) => {
  try {
    const settings = await ensureSettings();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyLimit = Number(req.app.locals.serperMonthlyLimit) || 2500;

    const recentRuns = await SerpRun.find({}).sort({ checkedAt: -1 }).limit(20).populate('brand', 'code name');
    const lastRun = recentRuns[0] || null;
    const keyUsageRowsLifetime = await SerpRun.aggregate([
      {
        $match: {
          $or: [{ keyId: { $ne: null } }, { keyName: { $exists: true, $ne: '' } }],
        },
      },
      {
        $group: {
          _id: {
            keyId: '$keyId',
            keyName: '$keyName',
          },
          total: { $sum: 1 },
        },
      },
    ]);
    const keyUsageRowsMonth = await SerpRun.aggregate([
      {
        $match: {
          checkedAt: { $gte: monthStart },
          $or: [{ keyId: { $ne: null } }, { keyName: { $exists: true, $ne: '' } }],
        },
      },
      {
        $group: {
          _id: {
            keyId: '$keyId',
            keyName: '$keyName',
          },
          total: { $sum: 1 },
        },
      },
    ]);

    const getCountFromRows = (rows, key) => {
      const byId = rows.find((row) => row._id?.keyId && row._id.keyId.toString() === key._id.toString());
      if (byId) return byId.total || 0;

      const byName = rows.find((row) => row._id?.keyName && row._id.keyName === key.name);
      return byName?.total || 0;
    };

    const tokenSummary = await Promise.all(
      (settings.serpApiKeys || []).map(async (item) => {
        const totalRequests = getCountFromRows(keyUsageRowsMonth, item);
        const totalRequestsLifetime = getCountFromRows(keyUsageRowsLifetime, item);
        const remainingEstimated = Math.max(monthlyLimit - totalRequests, 0);
        const remainingReported = item.lastKnownRemaining;

        const hasBaseline =
          Number.isFinite(item.baselineRemaining) && item.baselineCapturedAt instanceof Date;

        let remainingDisplay = remainingEstimated;
        let requestsDisplay = totalRequests;

        if (hasBaseline) {
          const baselineFilter = {
            checkedAt: { $gte: item.baselineCapturedAt },
            $or: [{ keyId: item._id }, { keyId: null, keyName: item.name }],
          };
          const requestsSinceBaseline = await SerpRun.countDocuments(baselineFilter);

          remainingDisplay = Math.max(item.baselineRemaining - requestsSinceBaseline, 0);
          requestsDisplay = monthlyLimit - remainingDisplay;
        } else if (typeof remainingReported === 'number' && Number.isFinite(remainingReported)) {
          remainingDisplay = remainingReported;
          requestsDisplay = monthlyLimit - remainingDisplay;
        }

        return {
          _id: item._id,
          name: item.name,
          isActive: item.isActive,
          monthlyLimit,
          totalRequests: requestsDisplay,
          totalRequestsLifetime,
          remainingEstimated,
          remainingReported,
          remainingDisplay,
          baselineRemaining: item.baselineRemaining,
          baselineCapturedAt: item.baselineCapturedAt,
          exhaustedAt: item.exhaustedAt,
          lastUsedAt: item.lastUsedAt,
          lastError: item.lastError,
        };
      })
    );

    // ── Uses new schedulerService directly instead of req.app.locals.autoCheckScheduler
    const schedulerStatus = scheduler.getStatus();

    return res.json({
      settings: getSanitizedSettings(settings),
      tokens: tokenSummary,
      lastRun: lastRun
        ? {
            _id: lastRun._id,
            brand: lastRun.brand,
            checkedAt: lastRun.checkedAt,
            trigger: lastRun.trigger,
            bestOwnRank: lastRun.bestOwnRank,
          }
        : null,
      recentRunCount: recentRuns.length,
      schedulerStatus,
    });
  } catch (error) {
    return next(error);
  }
};

const runAutoNow = async (req, res, next) => {
  try {
    // ── Uses new schedulerService directly instead of req.app.locals.autoCheckScheduler
    scheduler.runNowDetached();
    notifyAdminUpdate(req, { source: 'run-now' });
    return res.status(202).json({ ok: true, started: true, schedulerStatus: scheduler.getStatus() });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
};

const stopAutoRun = async (req, res, next) => {
  try {
    // ── Uses new schedulerService directly instead of req.app.locals.autoCheckScheduler
    const stopRequested = scheduler.requestStop();
    notifyAdminUpdate(req, { source: 'stop-run' });
    return res.json({ ok: true, stopRequested, schedulerStatus: scheduler.getStatus() });
  } catch (error) {
    return next(error);
  }
};

const getDomainActivityLogs = async (req, res, next) => {
  try {
    const { DomainActivityLog } = require('../models/DomainActivityLog');
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;

    const logs = await DomainActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('brand', 'code name')
      .populate('actor', 'username email role');

    return res.json(logs);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAdminSettings,
  updateSchedule,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  getAdminDashboard,
  runAutoNow,
  stopAutoRun,
  getDomainActivityLogs,
};