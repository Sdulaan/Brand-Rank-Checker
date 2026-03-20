const Brand = require('../models/Brand');
const SerpRun = require('../models/SerpRun');
const AdminSettings = require('../models/AdminSettings');
const { normalizeChatIds, getTelegramTokenFromSettings, parseWibTime, sendTelegramText } = require('./backupService');

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');

const getWibDateParts = (date = new Date()) => {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth() + 1,
    day: wib.getUTCDate(),
    hour: wib.getUTCHours(),
    minute: wib.getUTCMinutes(),
  };
};

const getWibClock = (date = new Date()) => {
  const { hour, minute } = getWibDateParts(date);
  return `${pad2(hour)}:${pad2(minute)} WIB`;
};

const getWibDateKey = (date = new Date()) => {
  const { year, month, day } = getWibDateParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const getWibHourSlotKey = (date = new Date()) => {
  const { year, month, day, hour } = getWibDateParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}-${pad2(hour)}`;
};

const getWibDayRangeUtc = (date = new Date()) => {
  const wibMs = date.getTime() + WIB_OFFSET_MS;
  const dayStartWibMs = Math.floor(wibMs / DAY_MS) * DAY_MS;
  return {
    start: new Date(dayStartWibMs - WIB_OFFSET_MS),
    end: new Date(dayStartWibMs + DAY_MS - WIB_OFFSET_MS),
  };
};

const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const summarizeChanges = ({ comparisons, latestByBrandCode }) => {
  const improved = [];
  const dropped = [];
  const notFound = [];
  let noChangeCount = 0;

  comparisons.forEach((item) => {
    const previousRank = item.previousRank;
    const currentRank = item.currentRank;

    if (currentRank === null) {
      notFound.push(item.brandCode);
    }

    if (previousRank === currentRank) {
      noChangeCount += 1;
      return;
    }

    if (previousRank !== null && currentRank !== null) {
      if (currentRank < previousRank) {
        improved.push(`${item.brandCode} ▲${previousRank - currentRank}`);
        return;
      }
      if (currentRank > previousRank) {
        dropped.push(`${item.brandCode} ▼${currentRank - previousRank}`);
        return;
      }
    }
  });

  const latestRows = Array.from(latestByBrandCode.values());
  const sortedByOwn = [...latestRows].sort((a, b) => (b.ownCount || 0) - (a.ownCount || 0));
  const leading = sortedByOwn[0] || null;
  const worst = [...latestRows].sort((a, b) => (a.ownCount || 0) - (b.ownCount || 0))[0] || null;

  return {
    noChangeCount,
    improved,
    dropped,
    notFound,
    leading,
    worst,
  };
};

const shortList = (items, fallback = '-') => (items.length ? items.slice(0, 8).join(', ') : fallback);

const formatRank = (rank) => (rank === null ? 'NF' : `#${rank}`);

// Returns only found (ranked) brand lines, sorted alphabetically
const buildActiveRankingLines = (comparisons) => {
  const sorted = [...comparisons]
    .filter((item) => item.currentRank !== null)
    .sort((a, b) => String(a.brandCode || '').localeCompare(String(b.brandCode || '')));

  return sorted.map((item) => {
    const { previousRank, currentRank, brandCode } = item;

    if (previousRank === null) {
      return `- ${brandCode}: NEW ${formatRank(currentRank)}`;
    }
    if (previousRank === currentRank) {
      return `- ${brandCode}: ${formatRank(currentRank)} (=)`;
    }
    if (currentRank < previousRank) {
      return `- ${brandCode}: ${formatRank(previousRank)} → ${formatRank(currentRank)} (▼${previousRank - currentRank})`;
    }
    // Don't show improvements in notifications
    return `- ${brandCode}: ${formatRank(currentRank)}`;
  });
};

// Build a compact snapshot label e.g. "A200M #1, D200M #2"
const buildSnapshotLabel = (comparisons) => {
  const found = comparisons
    .filter((item) => item.currentRank !== null)
    .sort((a, b) => (a.currentRank || 99) - (b.currentRank || 99));

  if (!found.length) return 'none found';
  return found.map((item) => `${item.brandCode} #${item.currentRank}`).join(', ');
};

// Build a snapshot label for the previous hour using previousRank
const buildPreviousSnapshotLabel = (comparisons) => {
  const found = comparisons
    .filter((item) => item.previousRank !== null)
    .sort((a, b) => (a.previousRank || 99) - (b.previousRank || 99));

  if (!found.length) return 'none found';
  return found.map((item) => `${item.brandCode} #${item.previousRank}`).join(', ');
};

const getSnapshotRank = (snapshot, brandCode) => {
  if (!snapshot || !brandCode) return null;
  if (snapshot instanceof Map) {
    const value = snapshot.get(brandCode);
    return Number.isFinite(value) ? value : null;
  }
  const value = snapshot[brandCode];
  return Number.isFinite(value) ? value : null;
};

const buildHourlySnapshot = (activeBrands, latestByBrandCode) => {
  const snapshot = {};
  activeBrands.forEach((brand) => {
    const brandCode = String(brand.code || '').trim().toUpperCase();
    if (!brandCode) return;
    const latest = latestByBrandCode.get(brandCode);
    snapshot[brandCode] = Number.isFinite(latest?.bestOwnRank) ? latest.bestOwnRank : -1;
  });
  return snapshot;
};

const hasSnapshotChanges = (previousSnapshot, currentSnapshot) => {
  const allBrandCodes = new Set([
    ...Object.keys(previousSnapshot || {}),
    ...Object.keys(currentSnapshot || {}),
  ]);
  for (const brandCode of allBrandCodes) {
    const prev = getSnapshotRank(previousSnapshot, brandCode);
    const curr = getSnapshotRank(currentSnapshot, brandCode);
    if ((prev ?? -1) !== (curr ?? -1)) return true;
  }
  return false;
};

const buildSnapshotHash = (snapshot) => {
  const normalized = Object.entries(snapshot || {})
    .map(([brandCode, rank]) => [String(brandCode || '').trim().toUpperCase(), Number(rank)])
    .filter(([brandCode]) => Boolean(brandCode))
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(normalized);
};

const buildComparisonsFromSnapshot = ({
  activeBrands,
  latestByBrandCode,
  previousSnapshot,
  previousByBrandCode,
}) =>
  activeBrands.map((brand) => {
    const brandCode = String(brand.code || '').trim().toUpperCase();
    const latest = latestByBrandCode.get(brandCode) || null;
    const previousSnapshotRank = getSnapshotRank(previousSnapshot, brandCode);
    return {
      brandCode,
      query: latest?.query || brandCode,
      primaryDomain: latest?.primaryDomain || '',
      currentRank: latest ? latest.bestOwnRank : null,
      previousRank: previousSnapshotRank !== null
        ? (previousSnapshotRank < 0 ? null : previousSnapshotRank)
        : (previousByBrandCode.get(brandCode)?.bestOwnRank ?? null),
    };
  });

const getOwnRowsByUrl = (run) => {
  const map = new Map();
  (run?.results || []).forEach((row) => {
    if (row?.badge !== 'OWN') return;
    const url =
      String(row?.matchedDomain?.domain || '').trim() ||
      String(row?.domainHost || '').trim() ||
      String(row?.link || '').trim();
    const rank = Number(row?.rank);
    if (!url || !Number.isFinite(rank)) return;
    if (!map.has(url) || rank < map.get(url)) {
      map.set(url, rank);
    }
  });
  return map;
};

const buildRankChangeMessages = ({ latestRunByBrandCode, previousRunByBrandCode }) => {
  const brandCodes = Array.from(new Set([...latestRunByBrandCode.keys(), ...previousRunByBrandCode.keys()])).sort();
  const messages = [];

  brandCodes.forEach((brandCode) => {
    const latestRun = latestRunByBrandCode.get(brandCode) || null;
    const previousRun = previousRunByBrandCode.get(brandCode) || null;
    if (!latestRun || !previousRun) return;

    const currentByUrl = getOwnRowsByUrl(latestRun);
    const previousByUrl = getOwnRowsByUrl(previousRun);
    const changedUrls = [];

    currentByUrl.forEach((currentRank, url) => {
      const previousRank = previousByUrl.get(url);
      if (!Number.isFinite(previousRank)) return;
      if (currentRank !== previousRank) {
        changedUrls.push({ url, previousRank, currentRank });
      }
    });

    if (!changedUrls.length) return;

    const lines = [`Brand : ${brandCode}`];
    changedUrls
      .sort((a, b) => a.currentRank - b.currentRank || a.url.localeCompare(b.url))
      .forEach((item) => {
        lines.push(`Url : ${item.url}`);
        lines.push(`Previous : #${item.previousRank}`);
        lines.push(`Current : #${item.currentRank}`);
        lines.push('x-x-x-x-x-x-x-x-');
      });

    messages.push(lines.join('\n'));
  });

  return messages;
};

// Derive the previous hour clock string from the current time
const getPreviousHourClock = (now) => {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const prevHour = new Date(wib.getTime() - 60 * 60 * 1000);
  return `${pad2(prevHour.getUTCHours())}:${pad2(prevHour.getUTCMinutes())} WIB`;
};

const buildHourlyMessage = ({ comparisons, latestByBrandCode, now }) => {
  const s = summarizeChanges({ comparisons, latestByBrandCode });
  const activeLines = buildActiveRankingLines(comparisons);
  const foundCount = activeLines.length;
  const notFoundCount = s.notFound.length;

  const lines = [
    `⏱️ Hourly Check — ${getWibClock(now)}`,
    '━━━━━━━━━━━━━━━━',
    `🏷️ ${comparisons.length} Brands Checked`,
    `✅ No change: ${s.noChangeCount} brand${s.noChangeCount !== 1 ? 's' : ''}`,
    `📉 Dropped: ${shortList(s.dropped, '-')}`,
    `❌ Not Found: ${notFoundCount} brand${notFoundCount !== 1 ? 's' : ''}`,
    `🏆 Leading: ${s.leading ? `${s.leading.brandCode} ${s.leading.ownCount || 0}/10 (${s.leading.bestOwnRank ? `#${s.leading.bestOwnRank}` : 'No rank'})` : '-'}`,
    '',
    '━━━━━━━━━━━━━━━━',
    `📋 Active Rankings (${foundCount} found)`,
    ...(foundCount > 0 ? activeLines : ['- None found this hour']),
    '━━━━━━━━━━━━━━━━',
  ];

  return lines.join('\n');
};

const buildInstantAlerts = ({ comparisons, alertOnDrop, alertOnNotFound, now }) => {
  const alerts = [];

  comparisons.forEach((item) => {
    const previousRank = item.previousRank;
    const currentRank = item.currentRank;

    // Skip improvements - only handle drops
    if (previousRank !== null && currentRank !== null && currentRank < previousRank) {
      return;
    }

    // Top 3 CRITICAL: Domain dropped from top 3 to outside top 3
    if (alertOnDrop && previousRank !== null && previousRank <= 3) {
      if (currentRank === null || currentRank > 3) {
        alerts.push({
          tier: 'critical',
          message: [
            `🔴 CRITICAL ALERT — ${item.brandCode}`,
            '━━━━━━━━━━━━━━━━',
            `⚠️ ${item.primaryDomain || item.brandCode} dropped from Top 3`,
            `🔑 Keyword: "${item.query || item.brandCode}"`,
            `📊 Was: #${previousRank} → Now: ${currentRank === null ? 'Not found' : `#${currentRank}`}`,
            `🕐 ${getWibClock(now)}`,
            '━━━━━━━━━━━━━━━━',
          ].join('\n'),
        });
        return;
      }
    }

    // Top 5 MEDIUM CRITICAL: Domain dropped from top 5 to outside top 5
    if (alertOnDrop && previousRank !== null && previousRank <= 5 && previousRank > 3) {
      if (currentRank === null || currentRank > 5) {
        alerts.push({
          tier: 'medium',
          message: [
            `🟠 MEDIUM ALERT — ${item.brandCode}`,
            '━━━━━━━━━━━━━━━━',
            `⚠️ ${item.primaryDomain || item.brandCode} dropped from Top 5`,
            `🔑 Keyword: "${item.query || item.brandCode}"`,
            `📊 Was: #${previousRank} → Now: ${currentRank === null ? 'Not found' : `#${currentRank}`}`,
            `🕐 ${getWibClock(now)}`,
            '━━━━━━━━━━━━━━━━',
          ].join('\n'),
        });
        return;
      }
    }

    // Top 10 LESSER CRITICAL: Domain dropped from top 10 to outside top 10
    if (alertOnDrop && previousRank !== null && previousRank <= 10 && previousRank > 5) {
      if (currentRank === null || currentRank > 10) {
        alerts.push({
          tier: 'low',
          message: [
            `🟡 ALERT — ${item.brandCode}`,
            '━━━━━━━━━━━━━━━━',
            `⚠️ ${item.primaryDomain || item.brandCode} dropped from Top 10`,
            `🔑 Keyword: "${item.query || item.brandCode}"`,
            `📊 Was: #${previousRank} → Now: ${currentRank === null ? 'Not found' : `#${currentRank}`}`,
            `🕐 ${getWibClock(now)}`,
            '━━━━━━━━━━━━━━━━',
          ].join('\n'),
        });
        return;
      }
    }

    // Alert when domain was not found (previous was ranked, now not found)
    if (alertOnNotFound && previousRank !== null && currentRank === null && previousRank > 10) {
      alerts.push({
        tier: 'info',
        message: [
          `ℹ️ Alert — ${item.brandCode}`,
          '━━━━━━━━━━━━━━━━',
          `❌ ${item.primaryDomain || item.brandCode} no longer found`,
          `🔑 Keyword: "${item.query || item.brandCode}"`,
          `📉 Was: #${previousRank} → Now: Not found`,
          `🕐 ${getWibClock(now)}`,
          '━━━━━━━━━━━━━━━━',
        ].join('\n'),
      });
    }
  });

  // Extract just the message text and limit to 8 alerts
  return alerts.slice(0, 8).map((alert) => alert.message);
};

const buildDailyDigest = ({ runsToday, intervalMinutes, now }) => {
  const byBrand = new Map();
  runsToday.forEach((run) => {
    const key = String(run.brand?.code || '');
    if (!key) return;
    if (!byBrand.has(key)) byBrand.set(key, []);
    byBrand.get(key).push(run);
  });

  let bestBrand = null;
  let mostVolatile = null;
  let mostStable = null;
  let totalOwnCount = 0;
  let totalSlots = 0;

  byBrand.forEach((runs, brandCode) => {
    const ownCounts = runs.map((r) => Number(r.ownCount) || 0);
    const avgOwn = ownCounts.length ? ownCounts.reduce((a, b) => a + b, 0) / ownCounts.length : 0;
    const ranks = runs.map((r) => (Number.isFinite(r.bestOwnRank) ? r.bestOwnRank : null));
    let totalDrop = 0;
    let changes = 0;
    for (let i = 1; i < ranks.length; i += 1) {
      const a = ranks[i - 1];
      const b = ranks[i];
      if (a === b) continue;
      changes += 1;
      if (a !== null && b !== null && b > a) totalDrop += b - a;
      if (a !== null && b === null) totalDrop += 10;
    }

    const zeroAllDay = ownCounts.length > 0 && ownCounts.every((v) => v === 0);
    const zeroHours = zeroAllDay ? Math.round((runs.length * intervalMinutes) / 60) : 0;

    if (!bestBrand || avgOwn > bestBrand.avgOwn) {
      bestBrand = { brandCode, avgOwn };
    }
    if (!mostVolatile || totalDrop > mostVolatile.totalDrop) {
      mostVolatile = { brandCode, totalDrop };
    }
    if (!mostStable || changes < mostStable.changes) {
      mostStable = { brandCode, changes };
    }

    byBrand.set(brandCode, {
      runs,
      avgOwn,
      totalDrop,
      changes,
      zeroAllDay,
      zeroHours,
    });
  });

  runsToday.forEach((run) => {
    totalOwnCount += Number(run.ownCount) || 0;
    totalSlots += 10;
  });
  const ownRate = totalSlots > 0 ? Math.round((totalOwnCount / totalSlots) * 100) : 0;

  const zeroRows = Array.from(byBrand.entries())
    .map(([brandCode, meta]) => ({ brandCode, ...meta }))
    .filter((row) => row.zeroAllDay)
    .sort((a, b) => b.zeroHours - a.zeroHours);

  const dateKey = getWibDateKey(now).split('-').reverse().join('/');
  return [
    `🌙 Daily Summary — ${dateKey}`,
    '━━━━━━━━━━━━━━━━',
    `${runsToday.length} checks completed today`,
    '',
    `🏆 Best brand: ${bestBrand ? `${bestBrand.brandCode} avg ${bestBrand.avgOwn.toFixed(1)}/10` : '-'}`,
    `📉 Most volatile: ${mostVolatile ? `${mostVolatile.brandCode} (▼${mostVolatile.totalDrop} total)` : '-'}`,
    `✅ Most stable: ${mostStable ? `${mostStable.brandCode} (${mostStable.changes} changes)` : '-'}`,
    `❌ Zero appearances: ${
      zeroRows.length ? `${zeroRows[0].brandCode} (${Math.max(1, zeroRows[0].zeroHours)}hrs)` : '-'
    }`,
    '',
    `📊 Overall own domain rate: ${ownRate}%`,
    '━━━━━━━━━━━━━━━━',
  ].join('\n');
};

const createNotificationService = ({ telegramBotToken = '' } = {}) => {
  const sendTextToTargets = async ({ token, chatIds, text }) => {
    await Promise.all(chatIds.map((chatId) => sendTelegramText({ token, chatId, text })));
  };

  const processAutoCheckRun = async ({ settings, now = new Date() }) => {
    if (!settings?.notificationsEnabled) return;

    const token = getTelegramTokenFromSettings(
      { backupTelegramBotToken: settings.notificationTelegramBotToken },
      telegramBotToken
    );
    if (!token) return;

    const chatIds = normalizeChatIds(settings.notificationTelegramChatIds);
    if (!chatIds.length) return;

    const activeBrands = await Brand.find({ isActive: true }).select('_id code').sort({ code: 1 }).lean();
    if (!activeBrands.length) return;

    const activeBrandIds = activeBrands.map((b) => b._id);
    const recentRows = await SerpRun.find({ brand: { $in: activeBrandIds }, trigger: 'auto' })
      .sort({ checkedAt: -1 })
      .populate('brand', 'code')
      .lean();

    const latestByBrandCode = new Map();
    const previousByBrandCode = new Map();
    const latestRunByBrandCode = new Map();
    const previousRunByBrandCode = new Map();
    recentRows.forEach((row) => {
      const code = String(row.brand?.code || '').trim().toUpperCase();
      if (!code) return;
      if (!latestByBrandCode.has(code)) {
        latestRunByBrandCode.set(code, row);
        latestByBrandCode.set(code, {
          brandCode: code,
          checkedAt: row.checkedAt,
          bestOwnRank: Number.isFinite(row.bestOwnRank) ? row.bestOwnRank : null,
          ownCount: Number(row.ownCount) || 0,
          query: row.query || code,
          primaryDomain: '',
        });
        return;
      }
      if (!previousByBrandCode.has(code)) {
        previousRunByBrandCode.set(code, row);
        previousByBrandCode.set(code, {
          bestOwnRank: Number.isFinite(row.bestOwnRank) ? row.bestOwnRank : null,
        });
      }
    });

    const comparisons = activeBrands.map((brand) => {
      const brandCode = String(brand.code || '').trim().toUpperCase();
      const latest = latestByBrandCode.get(brandCode) || null;
      const previous = previousByBrandCode.get(brandCode) || null;
      return {
        brandCode,
        query: latest?.query || brandCode,
        primaryDomain: latest?.primaryDomain || '',
        currentRank: latest ? latest.bestOwnRank : null,
        previousRank: previous ? previous.bestOwnRank : null,
      };
    });

    const intervalMinutes = Math.max(15, Math.round((Number(settings.checkIntervalHours) || 1) * 60));
    const wibParts = getWibDateParts(now);

    if (settings.notificationInstantEnabled) {
      const instantAlerts = buildInstantAlerts({
        comparisons,
        alertOnDrop: settings.notificationAlertOnDrop !== false,
        alertOnNotFound: settings.notificationAlertOnNotFound !== false,
        now,
      });
      for (const message of instantAlerts) {
        await sendTextToTargets({ token, chatIds, text: message });
      }
    }

    if (settings.notificationHourlyEnabled) {
      const slotKey = getWibHourSlotKey(now);
      const previousRunSnapshot = settings.notificationLastRunSnapshot || {};
      const currentSnapshot = buildHourlySnapshot(activeBrands, latestByBrandCode);
      const currentSnapshotHash = buildSnapshotHash(currentSnapshot);
      const hasChanges = hasSnapshotChanges(previousRunSnapshot, currentSnapshot);
      const isNewHour = settings.notificationLastHourlySlotKey !== slotKey;
      const shouldSend = hasChanges || isNewHour;

      if (shouldSend) {
        let canSend = true;
        if (settings?._id) {
          const claim = await AdminSettings.findOneAndUpdate(
            {
              _id: settings._id,
              $or: [
                { notificationLastSentSlotKey: { $ne: slotKey } },
                { notificationLastSentSnapshotHash: { $ne: currentSnapshotHash } },
              ],
            },
            {
              $set: {
                notificationLastSentSlotKey: slotKey,
                notificationLastSentSnapshotHash: currentSnapshotHash,
              },
            },
            { new: false }
          )
            .select('_id')
            .lean();
          canSend = Boolean(claim);
        }

        if (canSend) {
          const snapshotComparisons = buildComparisonsFromSnapshot({
            activeBrands,
            latestByBrandCode,
            previousSnapshot: previousRunSnapshot,
            previousByBrandCode,
          });
          const hourlyMessage = buildHourlyMessage({ comparisons: snapshotComparisons, latestByBrandCode, now });
          await sendTextToTargets({ token, chatIds, text: hourlyMessage });
          const rankChangeMessages = buildRankChangeMessages({
            latestRunByBrandCode,
            previousRunByBrandCode,
          });
          for (const message of rankChangeMessages) {
            await sendTextToTargets({ token, chatIds, text: message });
          }
          settings.notificationLastHourlySlotKey = slotKey;
          settings.notificationLastHourlySnapshot = currentSnapshot;
          settings.notificationLastSentSlotKey = slotKey;
          settings.notificationLastSentSnapshotHash = currentSnapshotHash;
        }
      }
      settings.notificationLastRunSnapshot = currentSnapshot;
    }

    if (settings.notificationDailyDigestEnabled) {
      const parsedTime = parseWibTime(settings.notificationDailyDigestTimeWib || '23:00') || { hour: 23, minute: 0 };
      const dateKey = getWibDateKey(now);
      const isAfterDigestTime =
        wibParts.hour > parsedTime.hour || (wibParts.hour === parsedTime.hour && wibParts.minute >= parsedTime.minute);

      if (isAfterDigestTime && settings.notificationLastDailyDigestDateKey !== dateKey) {
        const { start, end } = getWibDayRangeUtc(now);
        const runsToday = await SerpRun.find({
          trigger: 'auto',
          checkedAt: { $gte: start, $lt: end },
          brand: { $in: activeBrandIds },
        })
          .sort({ checkedAt: 1 })
          .populate('brand', 'code')
          .lean();

        const digestMessage = buildDailyDigest({ runsToday, intervalMinutes, now });
        await sendTextToTargets({ token, chatIds, text: digestMessage });
        settings.notificationLastDailyDigestDateKey = dateKey;
      }
    }
  };

  return {
    processAutoCheckRun,
  };
};

module.exports = {
  createNotificationService,
};
