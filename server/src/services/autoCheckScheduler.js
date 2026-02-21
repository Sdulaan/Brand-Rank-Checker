const AdminSettings = require('../models/AdminSettings');

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

  const computeNextRunAt = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);
  const notifyStatusChange = () => onStatusChange(getStatus());

  const setRunStart = (source) => {
    isRunning = true;
    stopRequested = false;
    progress = { processedBrands: 0, totalBrands: 0, brandCode: null };
    lastRunStartedAt = new Date();
    lastRunSource = source;
    lastError = null;
    notifyStatusChange();
  };

  const setRunFinish = ({ summary, error }) => {
    isRunning = false;
    lastRunFinishedAt = new Date();

    if (summary) {
      lastRunSummary = summary;
    }

    if (error) {
      lastError = error.message || String(error);
    }

    notifyStatusChange();
  };

  const runAutoCheck = async ({ source }) => {
    setRunStart(source);

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

      setRunFinish({
        summary: {
          source,
          totalBrands: outcomes.length,
          okCount,
          failCount,
          stopped,
        },
      });

      return { outcomes, stopped };
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

      const now = new Date();
      const shouldRun = !settings.nextAutoCheckAt || settings.nextAutoCheckAt <= now;
      if (!shouldRun) return;

      await runAutoCheck({ source: 'scheduler' });

      settings.lastAutoCheckAt = now;
      settings.nextAutoCheckAt = computeNextRunAt(settings.checkIntervalHours || 1);
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
      settings.lastAutoCheckAt = new Date();
      settings.nextAutoCheckAt = settings.autoCheckEnabled
        ? computeNextRunAt(settings.checkIntervalHours || 1)
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
