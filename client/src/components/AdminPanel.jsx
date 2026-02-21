import { useState, useEffect } from 'react';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

// Dropdown options — interval based
const INTERVAL_OPTIONS = [
  { value: '*/1',  label: 'Every 1 hour' },
  { value: '*/2',  label: 'Every 2 hours' },
  { value: '*/3',  label: 'Every 3 hours' },
  { value: '*/4',  label: 'Every 4 hours' },
  { value: '*/6',  label: 'Every 6 hours' },
  { value: '*/8',  label: 'Every 8 hours' },
  { value: '*/12', label: 'Every 12 hours' },
  { value: '*/24', label: 'Every 24 hours (Daily)' },
  { value: 'custom', label: 'Custom cron expression' },
];

// Maps dropdown value → real cron expression + display label
const INTERVAL_TO_CRON = {
  '*/1':  { expression: '0 */1 * * *',  label: 'Every 1 hour' },
  '*/2':  { expression: '0 */2 * * *',  label: 'Every 2 hours' },
  '*/3':  { expression: '0 */3 * * *',  label: 'Every 3 hours' },
  '*/4':  { expression: '0 */4 * * *',  label: 'Every 4 hours' },
  '*/6':  { expression: '0 */6 * * *',  label: 'Every 6 hours' },
  '*/8':  { expression: '0 */8 * * *',  label: 'Every 8 hours' },
  '*/12': { expression: '0 */12 * * *', label: 'Every 12 hours' },
  '*/24': { expression: '0 */24 * * *', label: 'Every 24 hours' },
};

/**
 * Calculates the next cron fire time from a cron expression.
 */
const getNextRunDate = (cronExpression) => {
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
};

// ── Auto state badge ──────────────────────────────────────────────────────────
const getAutoState = (settings, schedulerStatus, schedules) => {
  if (!settings?.autoCheckEnabled) {
    return {
      title: 'Auto Check Disabled',
      description: 'Scheduler is off. No automatic checks will run.',
      badgeClass: 'bg-slate-200 text-slate-700',
      panelClass: 'border-slate-200 bg-slate-50',
      dotClass: 'bg-slate-400',
    };
  }
  if (schedulerStatus?.isRunning && schedulerStatus?.stopRequested) {
    return {
      title: 'Stopping In Progress',
      description: 'Stop requested. Waiting for current brand checks to finish.',
      badgeClass: 'bg-amber-100 text-amber-800',
      panelClass: 'border-amber-200 bg-amber-50',
      dotClass: 'bg-amber-500',
    };
  }
  if (schedulerStatus?.isRunning) {
    return {
      title: 'Auto Check Running Now',
      description: 'System is currently checking brands in background.',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      panelClass: 'border-emerald-200 bg-emerald-50',
      dotClass: 'bg-emerald-500',
    };
  }

  // Use nextRunAt from the first active schedule (cron-based) as the source of truth
  const activeSchedule = schedules?.find((s) => s.isActive && s.nextRunAt);
  const nextAt = activeSchedule?.nextRunAt ? new Date(activeSchedule.nextRunAt) : null;

  if (nextAt && nextAt > new Date()) {
    return {
      title: 'Auto Check Scheduled',
      description: `Next run at ${formatDateTime(nextAt)}.`,
      badgeClass: 'bg-blue-100 text-blue-800',
      panelClass: 'border-blue-200 bg-blue-50',
      dotClass: 'bg-blue-500',
    };
  }
  return {
    title: 'Auto Check Ready',
    description: 'Enabled and waiting for next trigger.',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    panelClass: 'border-indigo-200 bg-indigo-50',
    dotClass: 'bg-indigo-500',
  };
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Schedule Row ──────────────────────────────────────────────────────────────
function ScheduleRow({ schedule, onToggle, onDelete, onRunNow }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <Toggle checked={schedule.isActive} onChange={() => onToggle(schedule.id)} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{schedule.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              schedule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {schedule.isActive ? '● Active' : '● Paused'}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
              {schedule.cronExpression}
            </code>
            <span className="text-slate-300">—</span>
            <span>{schedule.label}</span>
          </span>
          <span>🏷 {schedule.brands === 'all' ? 'All brands' : schedule.brands}</span>
          <span>⊞ Run count: {schedule.runCount ?? 0}</span>
          {schedule.lastRunAt ? (
            <span className="text-emerald-600">✓ Last run: {formatDateTime(schedule.lastRunAt)}</span>
          ) : (
            <span className="italic text-slate-400">Never run yet</span>
          )}
          {schedule.nextRunAt && (
            <span className="text-blue-600">🕐 Next run: {formatDateTime(schedule.nextRunAt)}</span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onRunNow(schedule.id)}
          className="flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          ▶ Run Now
        </button>
        <button
          type="button"
          onClick={() => onDelete(schedule.id)}
          className="rounded-md px-2 py-1.5 text-red-300 hover:bg-red-50 hover:text-red-500"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
function AdminPanel({
  dashboard,
  loading,
  error,
  onSaveSchedule,
  onAddKey,
  onUpdateKey,
  onDeleteKey,
  onRunNow,
  onStopRun,
  runActionLoading,
}) {
  const settings = dashboard?.settings;
  const tokenRows = dashboard?.tokens || [];
  const schedulerStatus = dashboard?.schedulerStatus;

  const [selectedInterval, setSelectedInterval] = useState('*/6');
  const [customCron, setCustomCron] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  // ── Schedules state ───────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  const autoState = getAutoState(settings, schedulerStatus, schedules);
  const progress = schedulerStatus?.progress || { processedBrands: 0, totalBrands: 0, brandCode: null };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setSchedulesLoading(true);
      const res = await fetch('/api/schedules');
      if (res.ok) setSchedules(await res.json());
    } catch (err) {
      console.error('Failed to fetch schedules', err);
    } finally {
      setSchedulesLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/schedules/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
    } catch (err) {
      console.error('Failed to toggle schedule', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete schedule', err);
    }
  };

  const handleScheduleRunNow = async (id) => {
    try {
      const res = await fetch(`/api/schedules/${id}/run`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
    } catch (err) {
      console.error('Failed to run schedule', err);
    }
  };

  const handleRunAutoCheck = async () => {
    // Always fire the one-time manual run
    onRunNow?.();

    if (!settings?.autoCheckEnabled) return;

    // Resolve cron expression — either from dropdown or custom input
    let cronExpression, label;

    if (selectedInterval === 'custom') {
      const trimmed = customCron.trim();
      if (!trimmed) {
        alert('Please enter a custom cron expression.');
        return;
      }
      cronExpression = trimmed;
      label = 'Custom';
    } else {
      const cronInfo = INTERVAL_TO_CRON[selectedInterval];
      if (!cronInfo) return;
      cronExpression = cronInfo.expression;
      label = cronInfo.label;
    }

    // If this exact cron already exists, just re-run it — don't duplicate
    const existing = schedules.find((s) => s.cronExpression === cronExpression);
    if (existing) {
      await handleScheduleRunNow(existing.id);
      return;
    }

    // Create new schedule
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: label,
          cronExpression,
          label,
          brands: 'all',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setSchedules((prev) => [...prev, created]);
      }
    } catch (err) {
      console.error('Failed to create schedule', err);
    }
  };

  // Derive the single source-of-truth next run time from active schedules
  const activeSchedule = schedules.find((s) => s.isActive && s.nextRunAt);
  const nextRunDisplay = activeSchedule?.nextRunAt || null;

  return (
    <section className="p-4 lg:p-6">
      <div className="space-y-4">

        {/* ── Auto Check & Schedules ── */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">Auto Check &amp; Schedules</h2>

            <div className="flex flex-wrap items-center gap-2">
              {settings && (
                <label className="flex select-none items-center gap-2 text-sm text-slate-600">
                  <Toggle
                    checked={settings.autoCheckEnabled}
                    onChange={(val) =>
                      onSaveSchedule({
                        autoCheckEnabled: val,
                        checkIntervalHours: 6,
                      })
                    }
                  />
                  Auto check enabled
                </label>
              )}

              {/* Interval dropdown */}
              <select
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {INTERVAL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              {/* Custom cron input — only shown when Custom is selected */}
              {selectedInterval === 'custom' && (
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="e.g. 0 9 * * 1-5"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono text-slate-700 focus:border-blue-500 focus:outline-none w-44"
                />
              )}

              {/* Run / Stop button */}
              {schedulerStatus?.isRunning ? (
                <button
                  type="button"
                  onClick={onStopRun}
                  disabled={runActionLoading || schedulerStatus?.stopRequested}
                  className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="h-2 w-2 rounded-sm bg-white opacity-90" />
                  {schedulerStatus?.stopRequested ? 'Stopping…' : runActionLoading ? 'Processing…' : 'Stop Check'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRunAutoCheck}
                  disabled={runActionLoading}
                  className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
                  </svg>
                  {runActionLoading ? 'Processing…' : 'Run Auto Check'}
                </button>
              )}
            </div>
          </div>

          {loading && <p className="px-5 py-3 text-sm text-slate-500">Loading settings…</p>}
          {error && <p className="mx-5 mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

          {/* Status panel */}
          {settings && (
            <div className={`mx-5 my-4 rounded-md border p-4 ${autoState.panelClass}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${autoState.badgeClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${autoState.dotClass}`} />
                  {autoState.title}
                </span>
                <span className="text-sm text-slate-600">{autoState.description}</span>
              </div>

              <div className="mt-3 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                <p><span className="font-medium text-slate-500">Last Auto Check:</span> {formatDateTime(schedulerStatus?.lastRunFinishedAt)}</p>
                <p><span className="font-medium text-slate-500">Next Auto Check:</span> {formatDateTime(nextRunDisplay)}</p>
                <p><span className="font-medium text-slate-500">Runtime:</span> {schedulerStatus?.isRunning ? 'Running' : 'Idle'}</p>
                <p><span className="font-medium text-slate-500">Last start:</span> {formatDateTime(schedulerStatus?.lastRunStartedAt)}</p>
                <p><span className="font-medium text-slate-500">Last finish:</span> {formatDateTime(schedulerStatus?.lastRunFinishedAt)}</p>
                <p><span className="font-medium text-slate-500">Last source:</span> {schedulerStatus?.lastRunSource || '-'}</p>
                <p>
                  <span className="font-medium text-slate-500">Last summary:</span>{' '}
                  {schedulerStatus?.lastRunSummary
                    ? `${schedulerStatus.lastRunSummary.okCount}/${schedulerStatus.lastRunSummary.totalBrands} success`
                    : '-'}
                </p>
                <p>
                  <span className="font-medium text-slate-500">Current progress:</span>{' '}
                  {schedulerStatus?.isRunning ? `${progress.processedBrands}/${progress.totalBrands || 0}` : '-'}
                </p>
                <p>
                  <span className="font-medium text-slate-500">Current brand:</span>{' '}
                  {schedulerStatus?.isRunning ? progress.brandCode || '-' : '-'}
                </p>
              </div>

              {schedulerStatus?.lastError && (
                <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
                  Last error: {schedulerStatus.lastError}
                </p>
              )}
            </div>
          )}

          {/* Automation Schedules list */}
          <div className="border-t border-slate-100 px-5 pb-5 pt-4">
            <div className="mb-3">
              <p className="text-sm font-medium text-slate-700">Automation Schedules</p>
              <p className="text-xs text-slate-400">
                Schedules are created automatically when Auto check is enabled and Run Auto Check is pressed.
              </p>
            </div>

            <div className="space-y-2">
              {schedulesLoading ? (
                <p className="py-4 text-center text-sm text-slate-400">Loading schedules…</p>
              ) : schedules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                  <p className="text-sm text-slate-400">No schedules yet.</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Enable <span className="font-medium text-slate-500">Auto check</span>, select an interval, then press{' '}
                    <span className="font-medium text-slate-500">Run Auto Check</span>.
                  </p>
                </div>
              ) : (
                schedules.map((schedule) => (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onRunNow={handleScheduleRunNow}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Serper API Keys ── */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Serper API Keys</h2>

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
                <tr className="text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Key</th>
                  <th className="px-3 py-2 text-left">Remaining (Month)</th>
                  <th className="px-3 py-2 text-left">Plan (Month)</th>
                  <th className="px-3 py-2 text-left">Requests (Month)</th>
                  <th className="px-3 py-2 text-left">Requests (Lifetime)</th>
                  <th className="px-3 py-2 text-left">Reported Remaining</th>
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
                      <td className="px-3 py-2">{item.remainingReported ?? '-'}</td>
                      <td className="px-3 py-2 text-xs">{formatDateTime(item.lastUsedAt)}</td>
                      <td className="px-3 py-2 text-xs">{formatDateTime(item.exhaustedAt)}</td>
                      <td className="px-3 py-2 text-xs text-rose-700">{item.lastError || '-'}</td>
                      <td className="px-3 py-2">{item.isActive ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateKey(item._id, { isActive: !item.isActive })}
                            className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                          >
                            {item.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteKey(item._id)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
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
              <p className="mt-2 text-xs text-slate-400">
                Remaining is shown after Serper returns quota headers or balance fields.
              </p>
            )}
            {tokenRows.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Remaining (Month) = Plan (Month) − Requests (Month). Reported Remaining is latest value returned by Serper.
              </p>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}

export default AdminPanel;