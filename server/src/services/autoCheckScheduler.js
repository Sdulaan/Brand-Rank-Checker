const AdminSettings = require('../models/AdminSettings');
const { DomainActivityLog, DOMAIN_ACTIVITY_ACTIONS } = require('../models/DomainActivityLog');
const { hoursToMinutes, getNextScheduledAt } = require('./scheduleTimeService');

const POLL_INTERVAL_MS = 30 * 1000;

const createAutoCheckScheduler = ({ serpRunService, onStatusChange = () => {} }) => {
  let timer = null;
  let isRunning = false;
  let stopRequested = false;

  let lastRunStartedAt = null;
  let lastRunFinishedAt = null;
  let lastRunSource = null;
  let lastRunSummary = null;
  let lastError = null;
  let progress = { processedBrands: 0, totalBrands: 0, brandCode: null };
  let recentRuns = [];

  const computeNextRunAt = (hours, baseTime = new Date()) =>
    getNextScheduledAt(baseTime, hoursToMinutes(hours));
  const notifyStatusChange = () => onStatusChange(getStatus());

  const setRunStart = (source) => {
    const startedAt = new Date();
    isRunning = true;
    stopRequested = false;
    progress = { processedBrands: 0, totalBrands: 0, brandCode: null };
    lastRunStartedAt = startedAt;
    lastRunSource = source;
    lastError = null;
    notifyStatusChange();
    return startedAt;
  };

  const setRunFinish = ({ summary, error }) => {
    isRunning = false;
    lastRunFinishedAt = new Date();

    if (summary) {
      lastRunSummary = summary;
      recentRuns = [
        {
          startedAt: summary.startedAt || lastRunStartedAt,
          finishedAt: lastRunFinishedAt,
          failCount: summary.failCount || 0,
          okCount: summary.okCount || 0,
          totalBrands: summary.totalBrands || 0,
          stopped: !!summary.stopped,
          source: summary.source || null,
          failureReasons: Array.isArray(summary.failureReasons) ? summary.failureReasons : [],
        },
        ...recentRuns,
      ].slice(0, 100);
    }

    if (error) {
      lastError = error.message || String(error);
    }

    notifyStatusChange();
  };

  const runAutoCheck = async ({ source }) => {
    const startedAt = setRunStart(source);

    try {
      const { outcomes, stopped } = await serpRunService.runAutoCheckForAllBrands({
        shouldStop: () => stopRequested,
        onProgress: (nextProgress) => {
          progress = nextProgress;
          notifyStatusChange();
        },
      });
      const okCount = outcomes.filter((item) => item.ok).length;
      const failCount = outcomes.length - okCount;
      const failureReasons = outcomes
        .filter((item) => !item.ok)
        .slice(0, 5)
        .map((item) => `${item.brandCode || 'unknown'}: ${item.error || 'Unknown error'}`);

      setRunFinish({
        summary: {
          source,
          startedAt,
          totalBrands: outcomes.length,
          okCount,
          failCount,
          stopped,
          failureReasons,
        },
      });

      return { outcomes, stopped, startedAt };
    } catch (error) {
      setRunFinish({ error });
      throw error;
    }
  };

  const tick = async () => {
    if (isRunning) return;

    try {
      const settings = await AdminSettings.findOne();
      if (!settings || !settings.autoCheckEnabled) return;

      if (!settings.nextAutoCheckAt) {
        settings.nextAutoCheckAt = computeNextRunAt(settings.checkIntervalHours || 1);
        await settings.save();
        return;
      }

      const now = new Date();
      const shouldRun = !settings.nextAutoCheckAt || settings.nextAutoCheckAt <= now;
      if (!shouldRun) return;

      const scheduledAt = settings.nextAutoCheckAt ? new Date(settings.nextAutoCheckAt) : now;
      const { outcomes } = await runAutoCheck({ source: 'scheduler' });

      try {
        const runSettings = await AdminSettings.findOne().select('autoCheckStartedBy');
        const actorId = runSettings?.autoCheckStartedBy || null;
        const logRows = outcomes.map((item) => ({
          action: DOMAIN_ACTIVITY_ACTIONS.AUTO_CHECK,
          domain: 'AUTO-CHECK',
          domainHostKey: 'auto-check',
          note: item.ok
            ? `Auto-check success for ${item.brandCode}`
            : `Auto-check failed for ${item.brandCode}: ${item.error || 'Unknown error'}`,
          brand: item.brandId || null,
          actor: actorId,
          metadata: {
            source: 'scheduler',
            ok: item.ok,
            checkedAt: item.checkedAt || null,
            error: item.error || null,
            brandCode: item.brandCode || null,
          },
        }));
        if (logRows.length) {
          await DomainActivityLog.insertMany(logRows, { ordered: false });
        }
      } catch (logError) {
        console.error('Auto-check activity log write failed:', logError.message);
      }

      settings.lastAutoCheckAt = new Date();
      settings.nextAutoCheckAt = computeNextRunAt(settings.checkIntervalHours || 1, scheduledAt);
      await settings.save();
    } catch (error) {
      console.error('Auto-check scheduler tick failed:', error.message);
    }
  };

  const runNow = async () => {
    if (isRunning) {
      const error = new Error('Auto check is already running');
      error.statusCode = 409;
      throw error;
    }

    const result = await runAutoCheck({ source: 'manual' });

    const settings = await AdminSettings.findOne();
    if (settings) {
      try {
        const actorId = settings.autoCheckStartedBy || null;
        const logRows = (result.outcomes || []).map((item) => ({
          action: DOMAIN_ACTIVITY_ACTIONS.AUTO_CHECK,
          domain: 'AUTO-CHECK',
          domainHostKey: 'auto-check',
          note: item.ok
            ? `Auto-check success for ${item.brandCode}`
            : `Auto-check failed for ${item.brandCode}: ${item.error || 'Unknown error'}`,
          brand: item.brandId || null,
          actor: actorId,
          metadata: {
            source: 'manual',
            ok: item.ok,
            checkedAt: item.checkedAt || null,
            error: item.error || null,
            brandCode: item.brandCode || null,
          },
        }));
        if (logRows.length) {
          await DomainActivityLog.insertMany(logRows, { ordered: false });
        }
      } catch (logError) {
        console.error('Manual auto-check activity log write failed:', logError.message);
      }

      settings.lastAutoCheckAt = new Date();
      settings.nextAutoCheckAt = settings.autoCheckEnabled
        ? computeNextRunAt(settings.checkIntervalHours || 1, result.startedAt || lastRunStartedAt || new Date())
        : null;
      await settings.save();
    }

    return result;
  };

  const runNowDetached = async () => {
    if (isRunning) {
      const error = new Error('Auto check is already running');
      error.statusCode = 409;
      throw error;
    }

    // Run in background so UI can show processing state and offer stop.
    runNow().catch((error) => {
      console.error('Manual auto-check run failed:', error.message);
    });
  };

  const requestStop = () => {
    if (!isRunning) return false;
    stopRequested = true;
    notifyStatusChange();
    return true;
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(tick, POLL_INTERVAL_MS);
    timer.unref();
    tick().catch((error) => {
      console.error('Auto-check scheduler startup tick failed:', error.message);
    });
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  const getStatus = () => ({
    isRunning,
    stopRequested,
    pollIntervalMs: POLL_INTERVAL_MS,
    lastRunStartedAt,
    lastRunFinishedAt,
    lastRunSource,
    lastRunSummary,
    lastError,
    progress,
    recentRuns,
  });

  return {
    start,
    stop,
    tick,
    runNow,
    runNowDetached,
    requestStop,
    getStatus,
  };
};

module.exports = {
  createAutoCheckScheduler,
};

