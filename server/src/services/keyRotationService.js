const AdminSettings = require('../models/AdminSettings');

const RATE_LIMIT_STATUSES = new Set([401, 402, 403, 429]);

const parseNumericLike = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value);
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractRemainingTokens = (headers = {}) => {
  const keys = [
    // Prefer monthly quota if provider exposes multiple scopes.
    'x-ratelimit-remaining-month',
    'x-ratelimit-remaining',
    'x-ratelimit-requests-remaining',
    'x-ratelimit-remaining-searches',
    'x-ratelimit-remaining-day',
    'x-api-quota-remaining',
    'x-credits-remaining',
  ];

  for (const key of keys) {
    const parsed = parseNumericLike(headers[key]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const extractRemainingFromBody = (payload = {}) => {
  const candidates = [
    payload.remaining,
    payload.remainingCredits,
    payload.creditsRemaining,
    payload.searchCreditsRemaining,
    payload.credits,
  ];

  for (const item of candidates) {
    const parsed = parseNumericLike(item);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const createKeyRotationService = () => {
  const getNextActiveKeys = (settings) => {
    const activeKeys = (settings.serpApiKeys || []).filter((item) => item.isActive);
    if (!activeKeys.length) return [];

    const cursor = settings.activeKeyCursor || 0;
    const offset = cursor % activeKeys.length;
    return [...activeKeys.slice(offset), ...activeKeys.slice(0, offset)];
  };

  const markCursor = (settings, usedKeyId) => {
    const activeKeys = (settings.serpApiKeys || []).filter((item) => item.isActive);
    const index = activeKeys.findIndex((item) => item._id.toString() === usedKeyId.toString());
    if (index === -1) return;

    settings.activeKeyCursor = (index + 1) % Math.max(activeKeys.length, 1);
  };

  const withRotatingKey = async (executor) => {
    const settings = await AdminSettings.findOne();
    if (!settings) {
      throw new Error('Admin settings missing');
    }

    const candidateKeys = getNextActiveKeys(settings);
    if (!candidateKeys.length) {
      const error = new Error('No active Serper API keys configured');
      error.statusCode = 400;
      throw error;
    }

    let lastError = null;

    for (const keyEntry of candidateKeys) {
      try {
        const response = await executor({ key: keyEntry.key, keyName: keyEntry.name });

        keyEntry.lastUsedAt = new Date();
        keyEntry.totalRequests = (keyEntry.totalRequests || 0) + 1;
        keyEntry.lastError = '';
        keyEntry.exhaustedAt = null;
        keyEntry.lastKnownRemaining =
          extractRemainingTokens(response.headers || {}) ?? extractRemainingFromBody(response.data || {});

        markCursor(settings, keyEntry._id);
        await settings.save();

        return {
          data: response.data,
          keyId: keyEntry._id,
          keyName: keyEntry.name,
          keyRemaining: keyEntry.lastKnownRemaining,
        };
      } catch (error) {
        lastError = error;

        keyEntry.lastUsedAt = new Date();
        keyEntry.totalRequests = (keyEntry.totalRequests || 0) + 1;
        keyEntry.lastError = error.response?.data?.message || error.message || 'Unknown API key failure';
        keyEntry.lastKnownRemaining =
          extractRemainingTokens(error.response?.headers || {}) ??
          extractRemainingFromBody(error.response?.data || {});

        if (RATE_LIMIT_STATUSES.has(error.response?.status)) {
          keyEntry.exhaustedAt = new Date();
        }

        await settings.save();
      }
    }

    throw lastError || new Error('All API keys failed');
  };

  return {
    withRotatingKey,
  };
};

module.exports = {
  createKeyRotationService,
};
