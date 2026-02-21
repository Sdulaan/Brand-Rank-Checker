import { useState } from 'react';

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

const buildSchedulePreview = (settings, schedulerStatus) => {
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
  onSaveSchedule,
  onStartAutoCheck,
  onStopRun,
  onAddKey,
  onUpdateKey,
  onDeleteKey,
  runActionLoading,
}) {
  const settings = dashboard?.settings;
  const tokenRows = dashboard?.tokens || [];
  const schedulerStatus = dashboard?.schedulerStatus;
  const autoState = getAutoState(settings, schedulerStatus);
  const progress = schedulerStatus?.progress || { processedBrands: 0, totalBrands: 0, brandCode: null };
  const selectedIntervalValue = String(getIntervalMinutes(settings));
  const schedulePreview = buildSchedulePreview(settings, schedulerStatus);
  const INITIAL_SLOT_COUNT = 14;
  const [showAllSlots, setShowAllSlots] = useState(false);
  const visibleSchedule = showAllSlots ? schedulePreview : schedulePreview.slice(0, INITIAL_SLOT_COUNT);

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  return (
    <section className="p-4 lg:p-6">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Auto Check Configuration</h2>

          {loading && <p className="mt-3 text-sm text-slate-500">Loading settings...</p>}
          {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

          {settings && (
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_auto]">
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
                  className="h-fit rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {schedulerStatus?.stopRequested ? 'Stopping...' : runActionLoading ? 'Processing...' : 'Stop Auto Check'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartAutoCheck}
                  disabled={runActionLoading}
                  className="h-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runActionLoading ? 'Processing...' : 'Run Auto Check'}
                </button>
              )}
            </div>
          )}

          {settings && (
            <div className={`mt-4 rounded-md border p-4 text-sm ${autoState.panelClass}`}>
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

              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Schedule Window (WIB: Previous 2 + Next 12 Hours)</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Success</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Failure</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Next</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Pending</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">Stopped</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Scheduled</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {visibleSchedule.map((item) => (
                    <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-2">
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
                {schedulePreview.length > INITIAL_SLOT_COUNT && (
                  <button
                    type="button"
                    onClick={() => setShowAllSlots((prev) => !prev)}
                    className="mt-3 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {showAllSlots ? 'Show Less' : `Show More (${schedulePreview.length - INITIAL_SLOT_COUNT} more)`}
                  </button>
                )}
              </div>

              {schedulerStatus?.lastError && (
                <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">Last error: {schedulerStatus.lastError}</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Serper API Keys</h2>

          <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto]">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="API key"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                onAddKey({ name: newKeyName, key: newKeyValue, isActive: true });
                setNewKeyName('');
                setNewKeyValue('');
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Key
            </button>
          </div>

          <div className="mt-4 overflow-auto">
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

                  return (
                    <tr key={item._id}>
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{maskedKey}</td>
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
                          <button
                            type="button"
                            onClick={() => onUpdateKey(item._id, { isActive: !item.isActive })}
                            className="rounded bg-slate-100 px-2 py-1 text-xs"
                          >
                            {item.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteKey(item._id)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                          >
                            Delete
                          </button>
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
      </div>
    </section>
  );
}

export default AdminPanel;
