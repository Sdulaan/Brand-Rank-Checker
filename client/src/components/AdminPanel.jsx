import { useEffect, useState } from 'react';

const INDONESIA_TIME_ZONE = 'Asia/Jakarta';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: INDONESIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatClock = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('id-ID', {
    timeZone: INDONESIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const toMinuteKey = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 60000);
};

const getIntervalMinutes = (settings) => {
  const direct = Number(settings?.checkIntervalMinutes);
  if (Number.isFinite(direct)) {
    const normalized = Math.max(15, Math.min(60, Math.round(direct)));
    if (normalized === 15 || normalized === 30 || normalized === 60) return normalized;
    return 60;
  }

  const fromHours = Number(settings?.checkIntervalHours);
  if (Number.isFinite(fromHours)) {
    const normalized = Math.max(15, Math.min(60, Math.round(fromHours * 60)));
    if (normalized === 15 || normalized === 30 || normalized === 60) return normalized;
    return 60;
  }

  return 60;
};

const buildSchedulePreview = (settings, schedulerStatus, persistedSlotStatuses = []) => {
  const intervalMinutes = getIntervalMinutes(settings);
  const slotMs = intervalMinutes * 60 * 1000;
  const now = new Date();
  const nowMs = now.getTime();
  const previousSlots = 2;
  const nextSlotsIn12Hours = Math.ceil((12 * 60) / intervalMinutes);
  const currentSlotMs = Math.floor(nowMs / slotMs) * slotMs;
  const startMs = currentSlotMs - previousSlots * slotMs;
  const recentRunStatusBySlot = new Map();
  (schedulerStatus?.recentRuns || []).forEach((run) => {
    const startedAt = run?.startedAt ? new Date(run.startedAt) : null;
    if (!startedAt || Number.isNaN(startedAt.getTime())) return;
    const slotStartMs = Math.floor(startedAt.getTime() / slotMs) * slotMs;
    const slotKey = toMinuteKey(new Date(slotStartMs));
    if (slotKey === null || recentRunStatusBySlot.has(slotKey)) return;
    const status = run.stopped ? 'Stopped' : Number(run.failCount || 0) > 0 ? 'Failure' : 'Success';
    const tooltip =
      status === 'Failure'
        ? ((run.failureReasons || []).length
            ? (run.failureReasons || []).join(' | ')
            : 'Run failed. See Auto Check Logs for details.')
        : '';
    recentRunStatusBySlot.set(slotKey, { status, tooltip });
  });
  const persistedStatusBySlot = new Map();
  (persistedSlotStatuses || []).forEach((item) => {
    const slotAt = item?.slotAt ? new Date(item.slotAt) : null;
    const slotKey = toMinuteKey(slotAt);
    if (slotKey === null || persistedStatusBySlot.has(slotKey)) return;
    persistedStatusBySlot.set(slotKey, {
      status: item?.status || 'Success',
      tooltip: '',
    });
  });
  const nextAutoKey = toMinuteKey(settings?.nextAutoCheckAt);

  return Array.from({ length: previousSlots + nextSlotsIn12Hours + 1 }, (_, index) => {
    const slotAt = new Date(startMs + index * slotMs);
    const slotKey = toMinuteKey(slotAt);

    let status = 'Scheduled';
    let tooltip = '';
    if (slotKey !== null && recentRunStatusBySlot.has(slotKey)) {
      const slotMeta = recentRunStatusBySlot.get(slotKey);
      status = slotMeta.status;
      tooltip = slotMeta.tooltip || '';
    } else if (slotKey !== null && persistedStatusBySlot.has(slotKey)) {
      const slotMeta = persistedStatusBySlot.get(slotKey);
      status = slotMeta.status;
      tooltip = slotMeta.tooltip || '';
    } else if (slotAt <= now) {
      status = 'Pending';
    }

    if (settings?.autoCheckEnabled && nextAutoKey !== null && slotKey === nextAutoKey) {
      status = 'Next';
    }

    return {
      key: `${slotAt.toISOString()}-${status}`,
      at: slotAt,
      status,
      tooltip,
    };
  });
};

const INTERVAL_OPTIONS = [15, 30, 60];
const BACKUP_FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON (.json)' },
  { value: 'ndjson', label: 'NDJSON (.ndjson)' },
];
const BACKUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_weekly', label: 'Twice Weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const getAutoState = (settings, schedulerStatus) => {
  if (schedulerStatus?.isRunning && schedulerStatus?.stopRequested) {
    return {
      code: 'stopping',
      title: 'Stopping In Progress',
      description: 'Stop requested. Waiting for current brand checks to finish.',
      badgeClass: 'bg-amber-100 text-amber-800',
      panelClass: 'border-amber-300 bg-amber-50',
    };
  }

  if (schedulerStatus?.isRunning) {
    return {
      code: 'running',
      title: 'Auto Check Running Now',
      description: 'System is currently checking brands in background.',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      panelClass: 'border-emerald-300 bg-emerald-50',
    };
  }

  if (!settings?.autoCheckEnabled) {
    return {
      code: 'disabled',
      title: 'Auto Check Stopped',
      description: 'Scheduler is stopped. No automatic checks will run.',
      badgeClass: 'bg-slate-200 text-slate-800',
      panelClass: 'border-slate-300 bg-slate-50',
    };
  }

  const nextAt = settings?.nextAutoCheckAt ? new Date(settings.nextAutoCheckAt) : null;
  const now = new Date();
  if (nextAt && nextAt > now) {
    return {
      code: 'scheduled',
      title: 'Auto Check Scheduled',
      description: `Next run at ${formatDateTime(nextAt)}.`,
      badgeClass: 'bg-blue-100 text-blue-800',
      panelClass: 'border-blue-300 bg-blue-50',
    };
  }

  return {
    code: 'ready',
    title: 'Auto Check Ready',
    description: 'Enabled and waiting for next trigger.',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    panelClass: 'border-indigo-300 bg-indigo-50',
  };
};

function AdminPanel({
  dashboard,
  loading,
  error,
  notice,
  onSaveSchedule,
  onStartAutoCheck,
  onStopRun,
  onAddKey,
  onUpdateKey,
  onDeleteKey,
  runActionLoading,
  onSaveBackupSettings,
  onSaveNotificationSettings,
  onRunBackupNow,
  backupActionLoading,
  onTestBackupTelegram,
  backupTestLoading,
  onTestNotificationTelegram,
  notificationTestLoading,
  sectionView = 'all',
  isManager = false,
}) {
  const settings = dashboard?.settings;
  const tokenRows = dashboard?.tokens || [];
  const schedulerStatus = dashboard?.schedulerStatus;
  const serperRuntime = dashboard?.serperRuntime || null;
  const runningKey = serperRuntime?.rotationKey || null;
  const runningKeyId = runningKey?._id || '';
  const runningKeyName = String(runningKey?.name || '').trim().toLowerCase();
  const autoState = getAutoState(settings, schedulerStatus);
  const progress = schedulerStatus?.progress || { processedBrands: 0, totalBrands: 0, brandCode: null };
  const selectedIntervalValue = String(getIntervalMinutes(settings));
  const schedulePreview = buildSchedulePreview(settings, schedulerStatus, dashboard?.autoCheckSlotStatuses || []);

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [editingKeyId, setEditingKeyId] = useState('');
  const [editingKeyName, setEditingKeyName] = useState('');
  const [editingKeyValue, setEditingKeyValue] = useState('');
  const [backupChatIdsText, setBackupChatIdsText] = useState('');
  const [backupBotTokenInput, setBackupBotTokenInput] = useState('');
  const [isEditingBotToken, setIsEditingBotToken] = useState(false);
  const [notificationChatIdsText, setNotificationChatIdsText] = useState('');
  const [notificationBotTokenInput, setNotificationBotTokenInput] = useState('');
  const [isEditingNotificationBotToken, setIsEditingNotificationBotToken] = useState(false);
  const [clearNotificationBotToken, setClearNotificationBotToken] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    notificationsEnabled: false,
    notificationHourlyEnabled: true,
    notificationInstantEnabled: true,
    notificationInstantDropThreshold: 3,
    notificationAlertOnDrop: true,
    notificationAlertOnNotFound: true,
    notificationDailyDigestEnabled: true,
    notificationDailyDigestTimeWib: '23:00',
  });

  
  const backupSchedulerStatus = dashboard?.backupSchedulerStatus;
  const backupRuns = dashboard?.backupRuns || [];
  const backupEnabled = !!settings?.backupEnabled;
  const backupTimeWib = settings?.backupTimeWib || '00:00';
  const backupFrequency = settings?.backupFrequency || 'daily';
  const backupTimeframeDays = Number(settings?.backupTimeframeDays) || 1;
  const backupFormat = settings?.backupFormat || 'json';
  const backupBotTokenConfigured = !!settings?.backupTelegramBotTokenConfigured;
  const backupBotTokenMasked = settings?.backupTelegramBotTokenMasked || '';
  const notificationsEnabled = !!settings?.notificationsEnabled;
  const notificationHourlyEnabled = settings?.notificationHourlyEnabled !== false;
  const notificationInstantEnabled = settings?.notificationInstantEnabled !== false;
  const notificationInstantDropThreshold = Number.isFinite(Number(settings?.notificationInstantDropThreshold))
    ? Math.max(1, Math.min(10, Math.floor(Number(settings.notificationInstantDropThreshold))))
    : 3;
  const notificationAlertOnDrop = settings?.notificationAlertOnDrop !== false;
  const notificationAlertOnNotFound = settings?.notificationAlertOnNotFound !== false;
  const notificationDailyDigestEnabled = settings?.notificationDailyDigestEnabled !== false;
  const notificationDailyDigestTimeWib = settings?.notificationDailyDigestTimeWib || '23:00';
  const notificationBotTokenConfigured = !!settings?.notificationTelegramBotTokenConfigured;
  const notificationBotTokenMasked = settings?.notificationTelegramBotTokenMasked || '';
  const showRankSection = !isManager && (sectionView === 'all' || sectionView === 'rank-check');
  const showBackupSection = !isManager && (sectionView === 'all' || sectionView === 'backup');
  const showNotificationSection = !isManager && (sectionView === 'all' || sectionView === 'notifications');
  const showApiSection = sectionView === 'all' || sectionView === 'rank-check';

  const currentChatIds = (settings?.backupTelegramChatIds || []).join(', ');
  const currentNotificationChatIds = (settings?.notificationTelegramChatIds || []).join(', ');
  useEffect(() => {
    setBackupChatIdsText(currentChatIds);
  }, [currentChatIds]);
  useEffect(() => {
    setNotificationChatIdsText(currentNotificationChatIds);
  }, [currentNotificationChatIds]);
  useEffect(() => {
    setNotificationForm({
      notificationsEnabled,
      notificationHourlyEnabled,
      notificationInstantEnabled,
      notificationInstantDropThreshold,
      notificationAlertOnDrop,
      notificationAlertOnNotFound,
      notificationDailyDigestEnabled,
      notificationDailyDigestTimeWib,
    });
    setClearNotificationBotToken(false);
  }, [
    notificationsEnabled,
    notificationHourlyEnabled,
    notificationInstantEnabled,
    notificationInstantDropThreshold,
    notificationAlertOnDrop,
    notificationAlertOnNotFound,
    notificationDailyDigestEnabled,
    notificationDailyDigestTimeWib,
  ]);

  const saveNotificationChanges = async () => {
    setNotificationSaving(true);
    try {
      const payload = {
        ...notificationForm,
        notificationTelegramChatIds: notificationChatIdsText,
      };
      if (clearNotificationBotToken) {
        payload.notificationTelegramBotToken = '';
      } else if (String(notificationBotTokenInput || '').trim()) {
        payload.notificationTelegramBotToken = String(notificationBotTokenInput).trim();
      }
      await onSaveNotificationSettings(payload);
      setNotificationBotTokenInput('');
      setIsEditingNotificationBotToken(false);
      setClearNotificationBotToken(false);
    } finally {
      setNotificationSaving(false);
    }
  };

  return (
    <section className="p-4 lg:p-6">
      <div className="space-y-5">
        {showRankSection && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Auto Check Configuration</h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              Automation
            </span>
          </div>

          {loading && <p className="mt-3 text-sm text-slate-500">Loading settings...</p>}
          {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          {notice && <p className="mt-3 rounded bg-blue-50 p-2 text-sm text-blue-700">{notice}</p>}

          {settings && (
            <div className="mt-4 grid items-end gap-3 lg:grid-cols-[220px_auto]">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Checking Frequency</label>
                <select
                  value={selectedIntervalValue}
                  onChange={(e) =>
                    onSaveSchedule({
                      checkIntervalMinutes: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {INTERVAL_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      Every {minutes} minutes
                    </option>
                  ))}
                </select>
              </div>

              {(settings.autoCheckEnabled || schedulerStatus?.isRunning) ? (
                <button
                  type="button"
                  onClick={onStopRun}
                  disabled={runActionLoading || schedulerStatus?.stopRequested}
                  className="h-fit rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {schedulerStatus?.stopRequested ? 'Stopping...' : runActionLoading ? 'Processing...' : 'Stop Auto Check'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartAutoCheck}
                  disabled={runActionLoading}
                  className="h-fit rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runActionLoading ? 'Processing...' : 'Run Auto Check'}
                </button>
              )}
            </div>
          )}

          {settings && (
            <div className={`mt-4 rounded-xl border p-4 text-sm ${autoState.panelClass}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${autoState.badgeClass}`}>
                  {autoState.title}
                </span>
                <span className="text-slate-700">{autoState.description} (WIB)</span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                <p>Last Auto Check: {formatDateTime(settings.lastAutoCheckAt)}</p>
                <p>Next Auto Check: {formatDateTime(settings.nextAutoCheckAt)}</p>
                <p>Auto Process: {settings.autoCheckEnabled ? 'Running' : 'Stopped'}</p>
                <p>Runtime: {schedulerStatus?.isRunning ? 'Running' : 'Idle'}</p>
                <p>Last start: {formatDateTime(schedulerStatus?.lastRunStartedAt)}</p>
                <p>Last finish: {formatDateTime(schedulerStatus?.lastRunFinishedAt)}</p>
                <p>Last source: {schedulerStatus?.lastRunSource || '-'}</p>
                <p>
                  Last summary:{' '}
                  {schedulerStatus?.lastRunSummary
                    ? `${schedulerStatus.lastRunSummary.okCount}/${schedulerStatus.lastRunSummary.totalBrands} success`
                    : '-'}
                </p>
                <p>
                  Current progress:{' '}
                  {schedulerStatus?.isRunning
                    ? `${progress.processedBrands}/${progress.totalBrands || 0}`
                    : '-'}
                </p>
                <p>Current brand: {schedulerStatus?.isRunning ? progress.brandCode || '-' : '-'}</p>
              </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Schedule Window (WIB: Previous 2 + Next 12 Hours From Now)</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Success</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Failure</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Next</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Pending</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">Stopped</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Scheduled</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {schedulePreview.map((item) => (
                    <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-700">{formatClock(item.at)}</p>
                      <span
                        title={item.status === 'Failure' ? item.tooltip : ''}
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${
                          item.status === 'Success'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'Failure'
                              ? 'bg-rose-100 text-rose-700'
                              : item.status === 'Stopped'
                                ? 'bg-orange-100 text-orange-700'
                              : item.status === 'Next'
                                ? 'bg-blue-100 text-blue-700'
                                : item.status === 'Pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {schedulerStatus?.lastError && (
                <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">Last error: {schedulerStatus.lastError}</p>
              )}
            </div>
          )}
        </div>
        )}

        {showBackupSection && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Telegram Backup Plan</h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Backup
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Recommended setup for large data: daily at 00:00 WIB, NDJSON format.
          </p>

          {settings && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Backup Frequency</label>
                <select
                  value={backupFrequency}
                  onChange={(e) => onSaveBackupSettings({ backupFrequency: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  {BACKUP_FREQUENCY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {backupFrequency === 'twice_weekly' && (
                  <p className="mt-1 text-[11px] text-slate-500">Twice weekly runs alternate every 3 and 4 days.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Backup Time (WIB)</label>
                <input
                  type="time"
                  value={backupTimeWib}
                  onChange={(e) => onSaveBackupSettings({ backupTimeWib: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Backup Format</label>
                <select
                  value={backupFormat}
                  onChange={(e) => onSaveBackupSettings({ backupFormat: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  {BACKUP_FORMAT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Telegram Bot Token / Bot ID
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="password"
                    value={backupBotTokenInput}
                    onChange={(e) => setBackupBotTokenInput(e.target.value)}
                    placeholder={
                      backupBotTokenConfigured
                        ? isEditingBotToken
                          ? 'Enter replacement bot token'
                          : `Configured: ${backupBotTokenMasked}`
                        : '123456789:AA...'
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveBackupSettings({ backupTelegramBotToken: backupBotTokenInput });
                      setBackupBotTokenInput('');
                      setIsEditingBotToken(false);
                    }}
                    className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    {isEditingBotToken ? 'Update Bot' : 'Save Bot'}
                  </button>
                </div>
                {backupBotTokenConfigured && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <span className="font-semibold">Saved Bot:</span>
                    <span className="font-mono">{backupBotTokenMasked}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingBotToken(true)}
                      className="rounded bg-white px-2 py-1 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSaveBackupSettings({ backupTelegramBotToken: '' });
                        setBackupBotTokenInput('');
                        setIsEditingBotToken(false);
                      }}
                      className="rounded bg-rose-100 px-2 py-1 font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Telegram Chat IDs (comma separated)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={backupChatIdsText}
                    onChange={(e) => setBackupChatIdsText(e.target.value)}
                    placeholder="-1001234567890, 987654321"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => onSaveBackupSettings({ backupTelegramChatIds: backupChatIdsText })}
                    className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    Save IDs
                  </button>
                  <button
                    type="button"
                    onClick={() => onTestBackupTelegram(backupChatIdsText)}
                    disabled={backupTestLoading}
                    className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {backupTestLoading ? 'Testing...' : 'Test Telegram'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {settings && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSaveBackupSettings({ backupEnabled: !backupEnabled })}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
                  backupEnabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {backupEnabled ? 'Stop Backup Schedule' : 'Run Backup Schedule'}
              </button>
              <button
                type="button"
                onClick={onRunBackupNow}
                disabled={backupActionLoading || backupSchedulerStatus?.isRunning}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {backupActionLoading || backupSchedulerStatus?.isRunning ? 'Running...' : 'Run Backup Now'}
              </button>
            </div>
          )}

          {settings && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <p>Backup Schedule: {backupEnabled ? 'Running' : 'Stopped'}</p>
                <p>Next Backup: {formatDateTime(settings.nextBackupAt)}</p>
                <p>Last Backup: {formatDateTime(settings.lastBackupAt)}</p>
                <p>
                  Data Window: last {backupTimeframeDays} day{backupTimeframeDays > 1 ? 's' : ''}
                </p>
                <p>Last Status: {settings.lastBackupStatus || 'idle'}</p>
              </div>
              {settings.lastBackupError && (
                <p className="mt-2 rounded bg-red-50 p-2 text-red-700">Last error: {settings.lastBackupError}</p>
              )}
            </div>
          )}

          <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Time</th>
                  <th className="px-2 py-2 text-left">Source</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Rows</th>
                  <th className="px-2 py-2 text-left">Files</th>
                  <th className="px-2 py-2 text-left">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backupRuns.map((item) => (
                  <tr key={item._id}>
                    <td className="px-2 py-2">{formatDateTime(item.createdAt)}</td>
                    <td className="px-2 py-2 capitalize">{item.source || '-'}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.status || '-'}
                      </span>
                    </td>
                    <td className="px-2 py-2">{item.totalRecords ?? 0}</td>
                    <td className="px-2 py-2">{item.totalFiles ?? 0}</td>
                    <td className="px-2 py-2">{item.triggeredBy?.username || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {backupRuns.length === 0 && <p className="mt-2 text-xs text-slate-500">No backup runs yet.</p>}
          </div>
        </div>
        )}

        {showNotificationSection && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Telegram Notifications</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Alerts
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Configure instant alerts, hourly batch, and daily digest for auto-check runs (WIB).
          </p>

          {settings && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setNotificationForm((prev) => ({
                      ...prev,
                      notificationsEnabled: !prev.notificationsEnabled,
                    }))
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
                    notificationForm.notificationsEnabled
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {notificationForm.notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationForm.notificationInstantEnabled}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationInstantEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span>Instant alerts</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationForm.notificationHourlyEnabled}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationHourlyEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span>Hourly summary</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationForm.notificationDailyDigestEnabled}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationDailyDigestEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span>Daily digest</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationForm.notificationAlertOnNotFound}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationAlertOnNotFound: e.target.checked,
                      }))
                    }
                  />
                  <span>Alert on not found</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notificationForm.notificationAlertOnDrop}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationAlertOnDrop: e.target.checked,
                      }))
                    }
                  />
                  <span>Alert on rank drop</span>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Instant drop threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={notificationForm.notificationInstantDropThreshold}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationInstantDropThreshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Daily digest time (WIB)
                  </label>
                  <input
                    type="time"
                    value={notificationForm.notificationDailyDigestTimeWib}
                    onChange={(e) =>
                      setNotificationForm((prev) => ({
                        ...prev,
                        notificationDailyDigestTimeWib: e.target.value,
                      }))
                    }
                    placeholder="23:00"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Notification Bot Token</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={notificationBotTokenInput}
                    onChange={(e) => {
                      setNotificationBotTokenInput(e.target.value);
                      setClearNotificationBotToken(false);
                    }}
                    placeholder={notificationBotTokenConfigured ? 'Enter new token to replace existing' : '123456:ABC...'}
                    type={isEditingNotificationBotToken ? 'text' : 'password'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Token changes apply after you click Update Notifications.</p>
                {notificationBotTokenConfigured && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="font-semibold">Saved Bot:</span>
                    <span className="font-mono">{notificationBotTokenMasked}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingNotificationBotToken(true)}
                      className="rounded bg-white px-2 py-1 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationBotTokenInput('');
                        setIsEditingNotificationBotToken(true);
                        setClearNotificationBotToken(true);
                      }}
                      className="rounded bg-rose-100 px-2 py-1 font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      Clear on Update
                    </button>
                  </div>
                )}
                {clearNotificationBotToken && (
                  <p className="mt-1 text-xs font-semibold text-rose-700">
                    Bot token will be removed when you click Update Notifications.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Telegram Chat IDs (comma separated)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={notificationChatIdsText}
                    onChange={(e) => setNotificationChatIdsText(e.target.value)}
                    placeholder="-1001234567890, 987654321"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onTestNotificationTelegram({
                        notificationTelegramChatIds: notificationChatIdsText,
                        notificationTelegramBotToken: notificationBotTokenInput,
                      })
                    }
                    disabled={notificationTestLoading}
                    className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {notificationTestLoading ? 'Testing...' : 'Test Notification'}
                  </button>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={saveNotificationChanges}
                    disabled={notificationSaving}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {notificationSaving ? 'Updating...' : 'Update Notifications'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {showApiSection && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Serper API Keys</h2>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              API Access
            </span>
          </div>

          <div className="mt-3 grid gap-2 rounded-xl border border-violet-200 bg-white/90 p-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <p>Active Keys: {serperRuntime?.activeKeyCount ?? 0}</p>
            <p>Rotation Cursor: {serperRuntime?.activeCursor ?? 0}</p>
            <p>Running Key: {serperRuntime?.rotationKey?.name || '-'}</p>
            <p>Last Used Key: {serperRuntime?.lastUsedKey?.name || '-'}</p>
            <p>Running Key Last Used: {formatDateTime(serperRuntime?.rotationKey?.lastUsedAt)}</p>
            <p>Last Used At: {formatDateTime(serperRuntime?.lastUsedKey?.lastUsedAt)}</p>
            <p className="sm:col-span-2 lg:col-span-4">
              Running Key Error: {serperRuntime?.rotationKey?.lastError || '-'}
            </p>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto]">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <input
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="API key"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="button"
              onClick={() => {
                onAddKey({ name: newKeyName, key: newKeyValue, isActive: true });
                setNewKeyName('');
                setNewKeyValue('');
              }}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Add Key
            </button>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Key</th>
                  <th className="px-3 py-2 text-left">Remaining (Month)</th>
                  <th className="px-3 py-2 text-left">Plan (Month)</th>
                  <th className="px-3 py-2 text-left">Requests (Month)</th>
                  <th className="px-3 py-2 text-left">Requests (Lifetime)</th>
                  <th className="px-3 py-2 text-left">Last Used</th>
                  <th className="px-3 py-2 text-left">Exhausted At</th>
                  <th className="px-3 py-2 text-left">Last Error</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tokenRows.map((item) => {
                  const maskedKey =
                    (settings?.serpApiKeys || []).find((key) => key._id === item._id)?.maskedKey || '***';
                  const isEditing = editingKeyId === item._id;
                  const itemName = String(item.name || '').trim().toLowerCase();
                  const isRunningKey = Boolean(
                    (runningKeyId && item._id === runningKeyId) ||
                    (runningKeyName && itemName && itemName === runningKeyName)
                  );

                  return (
                    <tr
                      key={item._id}
                      className={isRunningKey ? 'bg-violet-50/80 ring-1 ring-inset ring-violet-200' : ''}
                    >
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editingKeyName}
                              onChange={(e) => setEditingKeyName(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            />
                            {isRunningKey && (
                              <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Running
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {isRunningKey && (
                              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Running
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {isEditing ? (
                          <input
                            value={editingKeyValue}
                            onChange={(e) => setEditingKeyValue(e.target.value)}
                            placeholder="Enter new API key"
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          maskedKey
                        )}
                      </td>
                      <td className="px-3 py-2">{item.remainingDisplay ?? '-'}</td>
                      <td className="px-3 py-2">{item.monthlyLimit ?? '-'}</td>
                      <td className="px-3 py-2">{item.totalRequests ?? 0}</td>
                      <td className="px-3 py-2">{item.totalRequestsLifetime ?? 0}</td>
                      <td className="px-3 py-2 text-xs">{formatDateTime(item.lastUsedAt)}</td>
                      <td className="px-3 py-2 text-xs">{formatDateTime(item.exhaustedAt)}</td>
                      <td className="px-3 py-2 text-xs text-rose-700">{item.lastError || '-'}</td>
                      <td className="px-3 py-2">{item.isActive ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const payload = {
                                    name: editingKeyName.trim(),
                                  };
                                  if (editingKeyValue.trim()) {
                                    payload.key = editingKeyValue.trim();
                                  }
                                  onUpdateKey(item._id, payload);
                                  setEditingKeyId('');
                                  setEditingKeyName('');
                                  setEditingKeyValue('');
                                }}
                                className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingKeyId('');
                                  setEditingKeyName('');
                                  setEditingKeyValue('');
                                }}
                                className="rounded bg-slate-100 px-2 py-1 text-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onUpdateKey(item._id, { isActive: !item.isActive })}
                                className="rounded bg-slate-100 px-2 py-1 text-xs"
                              >
                                {item.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingKeyId(item._id);
                                  setEditingKeyName(item.name || '');
                                  setEditingKeyValue('');
                                }}
                                className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteKey(item._id)}
                                className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tokenRows.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Remaining is shown after Serper returns quota headers or balance fields.
              </p>
            )}
            {tokenRows.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Remaining (Month) = Plan (Month) - Requests (Lifetime).
              </p>
            )}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

export default AdminPanel;
