const MIN_INTERVAL_MINUTES = 15;
const MAX_INTERVAL_MINUTES = 60;
const DEFAULT_INTERVAL_MINUTES = 60;
const ALLOWED_INTERVAL_MINUTES = [15, 30, 60];
const WIB_OFFSET_MINUTES = 7 * 60;

const clampIntervalMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MINUTES;
  return Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, Math.round(parsed)));
};

const hoursToMinutes = (hours) => {
  const parsed = Number(hours);
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MINUTES;
  return clampIntervalMinutes(parsed * 60);
};

const minutesToHours = (minutes) => clampIntervalMinutes(minutes) / 60;

const isAllowedIntervalMinutes = (value) => ALLOWED_INTERVAL_MINUTES.includes(clampIntervalMinutes(value));

const normalizeAllowedIntervalMinutes = (value) => {
  const minutes = clampIntervalMinutes(value);
  if (ALLOWED_INTERVAL_MINUTES.includes(minutes)) return minutes;
  return DEFAULT_INTERVAL_MINUTES;
};

const getNextScheduledAt = (nowInput, intervalMinutesInput) => {
  const now = nowInput ? new Date(nowInput) : new Date();
  const intervalMinutes = clampIntervalMinutes(intervalMinutesInput);
  const wibAdjustedMs = now.getTime() + WIB_OFFSET_MINUTES * 60 * 1000;
  const nowMinute = Math.floor(wibAdjustedMs / 60000);
  const nextMinute = Math.ceil((nowMinute + 1) / intervalMinutes) * intervalMinutes;
  const nextWibAdjustedMs = nextMinute * 60000;
  return new Date(nextWibAdjustedMs - WIB_OFFSET_MINUTES * 60 * 1000);
};

module.exports = {
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
  DEFAULT_INTERVAL_MINUTES,
  ALLOWED_INTERVAL_MINUTES,
  WIB_OFFSET_MINUTES,
  clampIntervalMinutes,
  hoursToMinutes,
  minutesToHours,
  isAllowedIntervalMinutes,
  normalizeAllowedIntervalMinutes,
  getNextScheduledAt,
};
