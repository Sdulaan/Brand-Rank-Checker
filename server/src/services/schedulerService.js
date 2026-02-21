const cron = require('node-cron');
const AdminSettings = require('../models/AdminSettings');

// Lazy-load to avoid circular deps — set via init()
let serpRunService = null;

// ── In-memory state ───────────────────────────────────────────────────────────
const activeTasks = new Map();
let schedules = [];

// Runtime status (replaces autoCheckScheduler getStatus)
let isRunning = false;
let stopRequested = false;
let lastRunStartedAt = null;
let lastRunFinishedAt = null;
let lastRunSource = null;
let lastRunSummary = null;
let lastError = null;
let progress = { processedBrands: 0, totalBrands: 0, brandCode: null };

// Optional status-change callback (e.g. for socket.io push)
let onStatusChange = () => {};

// ── Init ──────────────────────────────────────────────────────────────────────

function init({ serpRunService: srs, onStatusChange: osc } = {}) {
  if (srs) serpRunService = srs;
  if (osc) onStatusChange = osc;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNextRunDate(cronExpression) {
  try {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return null;

    const [minuteField, hourField] = parts;
    const minute = parseInt(minuteField, 10);
    const now = new Date();

    let candidateHours = [];
    if (hourField === '*') {
      candidateHours = Array.from({ length: 24 }, (_, i) => i);
    } else if (hourField.startsWith('*/')) {
      const step = parseInt(hourField.slice(2), 10);
      for (let h = 0; h < 24; h += step) candidateHours.push(h);
    } else if (hourField.includes(',')) {
      candidateHours = hourField.split(',').map(Number);
    } else {
      candidateHours = [parseInt(hourField, 10)];
    }

    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      for (const hour of candidateHours) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + dayOffset);
        candidate.setHours(hour, minute, 0, 0);
        if (candidate > now) return candidate.toISOString();
      }
    }
  } catch (_) {}
  return null;
}

function notifyStatusChange() {
  try { onStatusChange(getStatus()); } catch (_) {}
}

// ── Core runner ───────────────────────────────────────────────────────────────

/**
 * Runs the brand-check logic for a given schedule.
 * Called by cron ticks AND runNow().
 */
async function runAutoCheck(scheduleId, source = 'scheduler') {
  const schedule = schedules.find((s) => s.id === scheduleId);
  if (!schedule || !schedule.isActive) return;

  if (isRunning) {
    console.warn(`[schedulerService] Skipping "${schedule.name}" — already running`);
    return;
  }

  // ── Set running state ─────────────────────────────────────────────────────
  isRunning = true;
  stopRequested = false;
  lastRunStartedAt = new Date();
  lastRunSource = source;
  lastError = null;
  progress = { processedBrands: 0, totalBrands: 0, brandCode: null };
  notifyStatusChange();

  console.log(`[schedulerService] Running "${schedule.name}" — ${schedule.cronExpression} (source: ${source})`);

  try {
    let outcomes = [];
    let stopped = false;

    if (serpRunService) {
      // ── Real brand-check logic ──────────────────────────────────────────
      ({ outcomes, stopped } = await serpRunService.runAutoCheckForAllBrands({
        shouldStop: () => stopRequested,
        onProgress: (nextProgress) => {
          progress = nextProgress;
          notifyStatusChange();
        },
      }));
    } else {
      console.warn('[schedulerService] serpRunService not initialised — skipping real check');
    }

    const okCount = outcomes.filter((o) => o.ok).length;
    const failCount = outcomes.length - okCount;

    lastRunSummary = { source, totalBrands: outcomes.length, okCount, failCount, stopped };
    lastRunFinishedAt = new Date();
    isRunning = false;
    notifyStatusChange();

    // ── Update schedule metadata ──────────────────────────────────────────
    schedules = schedules.map((s) =>
      s.id === scheduleId
        ? {
            ...s,
            runCount: (s.runCount ?? 0) + 1,
            lastRunAt: new Date().toISOString(),
            nextRunAt: getNextRunDate(s.cronExpression),
          }
        : s
    );

    // ── Persist timestamps to AdminSettings ───────────────────────────────
    try {
      const settings = await AdminSettings.findOne();
      if (settings) {
        settings.lastAutoCheckAt = lastRunFinishedAt;
        // Only update nextAutoCheckAt if autoCheck is still enabled
        if (settings.autoCheckEnabled) {
          settings.nextAutoCheckAt = getNextRunDate(schedule.cronExpression)
            ? new Date(getNextRunDate(schedule.cronExpression))
            : null;
        }
        await settings.save();
      }
    } catch (dbErr) {
      console.error('[schedulerService] Failed to update AdminSettings:', dbErr.message);
    }

    return { outcomes, stopped };

  } catch (error) {
    lastError = error.message || String(error);
    lastRunFinishedAt = new Date();
    isRunning = false;
    notifyStatusChange();
    console.error(`[schedulerService] Run failed for "${schedule.name}":`, error.message);
    throw error;
  }
}

// ── Task management ───────────────────────────────────────────────────────────

function startTask(schedule) {
  if (activeTasks.has(schedule.id)) {
    activeTasks.get(schedule.id).stop();
    activeTasks.delete(schedule.id);
  }

  if (!schedule.isActive) return;

  if (!cron.validate(schedule.cronExpression)) {
    console.warn(`[schedulerService] Invalid cron expression for "${schedule.name}": ${schedule.cronExpression}`);
    return;
  }

  const task = cron.schedule(
    schedule.cronExpression,
    () => runAutoCheck(schedule.id, 'scheduler'),
    {
      scheduled: true,
      timezone: 'UTC', // change to your server timezone e.g. 'Asia/Colombo'
    }
  );

  activeTasks.set(schedule.id, task);
  console.log(
    `[schedulerService] Started "${schedule.name}" → ${schedule.cronExpression} | Next: ${getNextRunDate(schedule.cronExpression)}`
  );
}

function stopTask(scheduleId) {
  if (activeTasks.has(scheduleId)) {
    activeTasks.get(scheduleId).stop();
    activeTasks.delete(scheduleId);
    console.log(`[schedulerService] Stopped job ${scheduleId}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call once on server start — re-registers all active schedules */
function restoreSchedules() {
  console.log('[schedulerService] Restoring schedules on server start...');
  schedules.filter((s) => s.isActive).forEach(startTask);
  console.log(`[schedulerService] ${schedules.filter((s) => s.isActive).length} schedule(s) restored.`);
}

/** Return all schedules */
function getAll() {
  return schedules;
}

/** Create a new schedule and immediately start its cron job */
function create({ name, cronExpression, label, brands = 'all' }) {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: "${cronExpression}"`);
  }

  const schedule = {
    id: String(Date.now()),
    name,
    cronExpression,
    label,
    brands,
    isActive: true,
    runCount: 0,
    lastRunAt: null,
    nextRunAt: getNextRunDate(cronExpression),
    createdAt: new Date().toISOString(),
  };

  schedules.push(schedule);
  startTask(schedule);
  return schedule;
}

/** Toggle a schedule active/inactive */
function toggle(id) {
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) throw new Error(`Schedule not found: ${id}`);

  schedule.isActive = !schedule.isActive;
  schedule.nextRunAt = schedule.isActive ? getNextRunDate(schedule.cronExpression) : null;

  if (schedule.isActive) {
    startTask(schedule);
  } else {
    stopTask(id);
  }

  return schedule;
}

/** Delete a schedule and stop its cron job */
function remove(id) {
  stopTask(id);
  schedules = schedules.filter((s) => s.id !== id);
}

/** Trigger a schedule's run immediately (awaited — use for API responses) */
async function runNow(id) {
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) throw new Error(`Schedule not found: ${id}`);
  await runAutoCheck(id, 'manual');
  return schedules.find((s) => s.id === id);
}

/**
 * Trigger a one-off manual run NOT tied to any schedule row.
 * Fires in the background so the HTTP response returns immediately.
 * Mirrors the old autoCheckScheduler.runNowDetached().
 */
function runNowDetached(cronExpression = '0 8 * * *') {
  if (isRunning) {
    const error = new Error('Auto check is already running');
    error.statusCode = 409;
    throw error;
  }

  // Find or create a temporary in-memory schedule entry to drive runAutoCheck
  const tempId = '__manual__';
  const existing = schedules.find((s) => s.id === tempId);
  if (!existing) {
    schedules.push({
      id: tempId,
      name: 'Manual Run',
      cronExpression,
      label: 'Manual',
      brands: 'all',
      isActive: true,
      runCount: 0,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  runAutoCheck(tempId, 'manual').catch((err) => {
    console.error('[schedulerService] Detached manual run failed:', err.message);
  });
}

/** Request a graceful stop of the currently running check */
function requestStop() {
  if (!isRunning) return false;
  stopRequested = true;
  notifyStatusChange();
  return true;
}

/** Returns current runtime status — same shape as old autoCheckScheduler.getStatus() */
function getStatus() {
  return {
    isRunning,
    stopRequested,
    lastRunStartedAt,
    lastRunFinishedAt,
    lastRunSource,
    lastRunSummary,
    lastError,
    progress,
  };
}

module.exports = {
  init,
  restoreSchedules,
  getAll,
  create,
  toggle,
  remove,
  runNow,
  runNowDetached,
  requestStop,
  getStatus,
};