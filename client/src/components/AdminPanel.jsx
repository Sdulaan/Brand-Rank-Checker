import { useState } from 'react';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};
const INTERVAL_OPTIONS = [
  { value: '0.08333333333333333', label: 'Every 5 minutes (Testing)' },
  { value: '1', label: 'Every 1 hour' },
  { value: '2', label: 'Every 2 hours' },
  { value: '3', label: 'Every 3 hours' },
  { value: '4', label: 'Every 4 hours' },
  { value: '6', label: 'Every 6 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Every 24 hours' },
];

const getAutoState = (settings, schedulerStatus) => {
  if (!settings?.autoCheckEnabled) {
    return {
      code: 'disabled',
      title: 'Auto Check Disabled',
      description: 'Scheduler is off. No automatic checks will run.',
      badgeClass: 'bg-slate-200 text-slate-800',
      panelClass: 'border-slate-300 bg-slate-50',
    };
  }

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
  const autoState = getAutoState(settings, schedulerStatus);
  const progress = schedulerStatus?.progress || { processedBrands: 0, totalBrands: 0, brandCode: null };
  const selectedIntervalValue = (() => {
    const current = Number(settings?.checkIntervalHours);
    if (!Number.isFinite(current)) return '1';
    const matched = INTERVAL_OPTIONS.find((item) => Math.abs(Number(item.value) - current) < 1e-9);
    return matched ? matched.value : String(current);
  })();

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
            <div className="mt-4 grid gap-3 lg:grid-cols-[200px_200px_auto]">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.autoCheckEnabled}
                  onChange={(e) =>
                    onSaveSchedule({
                      autoCheckEnabled: e.target.checked,
                      checkIntervalHours: settings.checkIntervalHours,
                    })
                  }
                />
                Auto check enabled
              </label>

              <select
                value={selectedIntervalValue}
                onChange={(e) =>
                  onSaveSchedule({
                    autoCheckEnabled: settings.autoCheckEnabled,
                    checkIntervalHours: Number(e.target.value),
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {INTERVAL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              {schedulerStatus?.isRunning ? (
                <button
                  type="button"
                  onClick={onStopRun}
                  disabled={runActionLoading || schedulerStatus?.stopRequested}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {schedulerStatus?.stopRequested ? 'Stopping...' : runActionLoading ? 'Processing...' : 'Stop Process'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRunNow}
                  disabled={runActionLoading}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runActionLoading ? 'Processing...' : 'Run Auto Check Now'}
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
                <span className="text-slate-700">{autoState.description}</span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                <p>Last Auto Check: {formatDateTime(settings.lastAutoCheckAt)}</p>
                <p>Next Auto Check: {formatDateTime(settings.nextAutoCheckAt)}</p>
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
                Remaining (Month) = Plan (Month) - Requests (Month). Reported Remaining is latest value returned by Serper.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AdminPanel;
