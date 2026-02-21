const AdminSettings = require('../models/AdminSettings');
const { hoursToMinutes, minutesToHours, normalizeAllowedIntervalMinutes } = require('./scheduleTimeService');

const DEFAULT_INTERVAL_HOURS = 1;

const parseEnvKeys = (rawValue) => {
  if (!rawValue) return [];
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((key, index) => ({
      name: `ENV Key ${index + 1}`,
      key,
      isActive: true,
    }));
};

const ensureSettings = async ({ envKeys = [] } = {}) => {
  let settings = await AdminSettings.findOne();

  if (!settings) {
    settings = await AdminSettings.create({
      autoCheckEnabled: false,
      checkIntervalHours: DEFAULT_INTERVAL_HOURS,
      serpApiKeys: envKeys,
      nextAutoCheckAt: null,
    });
    return settings;
  }

  let shouldSave = false;

  const normalizedHours = minutesToHours(
    normalizeAllowedIntervalMinutes(hoursToMinutes(settings.checkIntervalHours || DEFAULT_INTERVAL_HOURS))
  );
  if (Math.abs(Number(settings.checkIntervalHours || 0) - normalizedHours) > 1e-9) {
    settings.checkIntervalHours = normalizedHours;
    shouldSave = true;
  }

  if (!settings.serpApiKeys?.length && envKeys.length) {
    settings.serpApiKeys = envKeys;
    shouldSave = true;
  }

  if (shouldSave) {
    await settings.save();
  }

  return settings;
};

const getSettings = async () => {
  const settings = await AdminSettings.findOne();
  return settings;
};

const applyBaselineFromEnv = async ({ baselineRemaining, baselineKeyName = '' }) => {
  if (!Number.isFinite(baselineRemaining) || baselineRemaining < 0) return null;

  const settings = await AdminSettings.findOne();
  if (!settings?.serpApiKeys?.length) return null;

  const target =
    settings.serpApiKeys.find((item) => item.name === baselineKeyName) ||
    settings.serpApiKeys[0];

  if (!target || target.baselineCapturedAt) return settings;

  target.baselineRemaining = baselineRemaining;
  target.baselineCapturedAt = new Date();
  await settings.save();
  return settings;
};

const getSanitizedSettings = (settings) => {
  if (!settings) return null;

  return {
    _id: settings._id,
    autoCheckEnabled: settings.autoCheckEnabled,
    checkIntervalHours: settings.checkIntervalHours,
    checkIntervalMinutes: normalizeAllowedIntervalMinutes(
      hoursToMinutes(settings.checkIntervalHours || DEFAULT_INTERVAL_HOURS)
    ),
    lastAutoCheckAt: settings.lastAutoCheckAt,
    nextAutoCheckAt: settings.nextAutoCheckAt,
    autoCheckStartedBy: settings.autoCheckStartedBy || null,
    serpApiKeys: (settings.serpApiKeys || []).map((item) => ({
      _id: item._id,
      name: item.name,
      isActive: item.isActive,
      lastUsedAt: item.lastUsedAt,
      exhaustedAt: item.exhaustedAt,
      lastError: item.lastError,
      lastKnownRemaining: item.lastKnownRemaining,
      totalRequests: item.totalRequests,
      baselineRemaining: item.baselineRemaining,
      baselineCapturedAt: item.baselineCapturedAt,
      maskedKey: item.key?.length > 6 ? `${item.key.slice(0, 3)}***${item.key.slice(-3)}` : '***',
    })),
  };
};

module.exports = {
  DEFAULT_INTERVAL_HOURS,
  parseEnvKeys,
  ensureSettings,
  getSettings,
  applyBaselineFromEnv,
  getSanitizedSettings,
};

