const SerpRun = require('../models/SerpRun');
const { DomainActivityLog, DOMAIN_ACTIVITY_ACTIONS } = require('../models/DomainActivityLog');
const { ensureSettings, getSanitizedSettings } = require('../services/adminSettingsService');
const {
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
  minutesToHours,
  hoursToMinutes,
  isAllowedIntervalMinutes,
  getNextScheduledAt,
} = require('../services/scheduleTimeService');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const notifyAdminUpdate = (req, payload = {}) => req.app.locals.emitAdminUpdate?.(payload);
const getLogLimit = (queryLimit) => {
  const limitRaw = Number(queryLimit);
  return Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;
};

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
    const intervalMinutes = toNumber(req.body.checkIntervalMinutes);
    const effectiveIntervalMinutes = intervalMinutes !== null ? intervalMinutes : hoursToMinutes(intervalHours);
    const intervalChanged = intervalMinutes !== null || intervalHours !== null;

    // Time changes require restarting auto-check (stop then run) to take effect.
    if (intervalChanged && settings.autoCheckEnabled && enabled !== false) {
      return res.status(409).json({
        error: 'Stop auto check and run again to apply time change',
      });
    }

    if (typeof enabled === 'boolean') {
      const wasEnabled = settings.autoCheckEnabled;
      settings.autoCheckEnabled = enabled;
      if (enabled) {
        settings.nextAutoCheckAt = getNextScheduledAt(new Date(), hoursToMinutes(settings.checkIntervalHours));
        settings.autoCheckStartedBy = req.user?._id || settings.autoCheckStartedBy || null;
      }
      if (!wasEnabled && enabled) {
        await DomainActivityLog.create({
          action: DOMAIN_ACTIVITY_ACTIONS.AUTO_START,
          domain: 'AUTO-CHECK',
          domainHostKey: 'auto-check',
          note: `Auto-check started (${hoursToMinutes(settings.checkIntervalHours)} min interval)`,
          actor: req.user?._id || null,
          metadata: {
            intervalMinutes: hoursToMinutes(settings.checkIntervalHours),
            nextAutoCheckAt: settings.nextAutoCheckAt,
          },
        });
      }
      if (!enabled) {
        settings.nextAutoCheckAt = null;
        settings.autoCheckStartedBy = null;
      }
    }

    if (intervalChanged) {
      if (effectiveIntervalMinutes < MIN_INTERVAL_MINUTES || effectiveIntervalMinutes > MAX_INTERVAL_MINUTES) {
        return res.status(400).json({
          error: `checkIntervalMinutes must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES}`,
        });
      }
      if (!isAllowedIntervalMinutes(effectiveIntervalMinutes)) {
        return res.status(400).json({
          error: 'checkIntervalMinutes must be one of: 15, 30, 60',
        });
      }

      settings.checkIntervalHours = minutesToHours(effectiveIntervalMinutes);
      if (settings.autoCheckEnabled) {
        settings.nextAutoCheckAt = getNextScheduledAt(new Date(), effectiveIntervalMinutes);
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
        const totalRequestsMonth = getCountFromRows(keyUsageRowsMonth, item);
        const totalRequestsLifetime = getCountFromRows(keyUsageRowsLifetime, item);
        const remainingDisplay = Math.max(monthlyLimit - totalRequestsLifetime, 0);

        return {
          _id: item._id,
          name: item.name,
          isActive: item.isActive,
          monthlyLimit,
          totalRequests: totalRequestsMonth,
          totalRequestsLifetime,
          remainingEstimated: remainingDisplay,
          remainingReported: null,
          remainingDisplay,
          baselineRemaining: item.baselineRemaining,
          baselineCapturedAt: item.baselineCapturedAt,
          exhaustedAt: item.exhaustedAt,
          lastUsedAt: item.lastUsedAt,
          lastError: item.lastError,
        };
      })
    );

    const schedulerStatus = req.app.locals.autoCheckScheduler?.getStatus?.() || null;

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
    const scheduler = req.app.locals.autoCheckScheduler;
    if (!scheduler) {
      return res.status(500).json({ error: 'Auto check scheduler unavailable' });
    }

    await scheduler.runNowDetached();
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
    const scheduler = req.app.locals.autoCheckScheduler;
    if (!scheduler) {
      return res.status(500).json({ error: 'Auto check scheduler unavailable' });
    }

    const settings = await ensureSettings();
    const wasEnabled = settings.autoCheckEnabled;
    settings.autoCheckEnabled = false;
    settings.nextAutoCheckAt = null;
    const previousStartedBy = settings.autoCheckStartedBy;
    settings.autoCheckStartedBy = null;
    await settings.save();

    if (wasEnabled || scheduler.getStatus()?.isRunning) {
      await DomainActivityLog.create({
        action: DOMAIN_ACTIVITY_ACTIONS.AUTO_STOP,
        domain: 'AUTO-CHECK',
        domainHostKey: 'auto-check',
        note: 'Auto-check stopped',
        actor: req.user?._id || previousStartedBy || null,
        metadata: {
          stopRequestedWhileRunning: scheduler.getStatus()?.isRunning || false,
        },
      });
    }

    const stopRequested = scheduler.requestStop();
    notifyAdminUpdate(req, { source: 'stop-run' });
    return res.json({
      ok: true,
      stopRequested,
      schedulerStatus: scheduler.getStatus(),
      settings: getSanitizedSettings(settings),
    });
  } catch (error) {
    return next(error);
  }
};

const getDomainActivityLogs = async (req, res, next) => {
  try {
    const limit = getLogLimit(req.query.limit);

    const logs = await DomainActivityLog.find({
      action: {
        $in: [DOMAIN_ACTIVITY_ACTIONS.ADD, DOMAIN_ACTIVITY_ACTIONS.DELETE],
      },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('brand', 'code name')
      .populate('actor', 'username email role');

    return res.json(logs);
  } catch (error) {
    return next(error);
  }
};

const getAutoCheckLogs = async (req, res, next) => {
  try {
    const limit = getLogLimit(req.query.limit);

    const logs = await DomainActivityLog.find({
      action: {
        $in: [
          DOMAIN_ACTIVITY_ACTIONS.AUTO_START,
          DOMAIN_ACTIVITY_ACTIONS.AUTO_STOP,
          DOMAIN_ACTIVITY_ACTIONS.AUTO_CHECK,
        ],
      },
    })
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
  getAutoCheckLogs,
};

