import { useEffect, useMemo, useState } from 'react';
import { getBulkDomainCheck, startBulkDomainCheck, stopBulkDomainCheck } from '../services/api';

const ACTIVE_RUN_STORAGE_KEY = 'bulk_domain_checker_run_id';
const DOMAINS_TEXT_STORAGE_KEY = 'bulk_domain_checker_domains_text';

const toCsv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

const isTerminalStatus = (status) => status === 'completed' || status === 'stopped' || status === 'failed';

function BulkDomainCheckerPanel() {
  const [domainsText, setDomainsText] = useState(() => localStorage.getItem(DOMAINS_TEXT_STORAGE_KEY) || '');
  const [minResults, setMinResults] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runId, setRunId] = useState('');
  const [runState, setRunState] = useState(null);

  const domainCount = useMemo(
    () =>
      domainsText
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean).length,
    [domainsText]
  );

  const passedDomainsText = useMemo(
    () => (runState?.passed || []).map((item) => item.domain).join('\n'),
    [runState]
  );

  useEffect(() => {
    const savedRunId = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY) || '';
    if (savedRunId) {
      setRunId(savedRunId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DOMAINS_TEXT_STORAGE_KEY, domainsText);
  }, [domainsText]);

  useEffect(() => {
    if (!runId) return undefined;

    let timer = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const payload = await getBulkDomainCheck(runId);
        if (cancelled) return;
        setRunState(payload);

        if (isTerminalStatus(payload.status)) {
          setLoading(false);
          if (payload.status === 'failed' && payload.error) {
            setError(payload.error);
          }
          return;
        }

        timer = setTimeout(poll, 1000);
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setRunState(null);
        setRunId('');
        localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
        setError(err.message || 'Failed to fetch run status');
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  const exportCsv = (list, filename) => {
    const csv = toCsv([
      ['Domain', 'Result Count', 'Status', 'Error'],
      ...list.map((item) => [item.domain, item.count, item.passed ? 'PASSED' : 'FAILED', item.error || '']),
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyPassedDomains = async () => {
    if (!passedDomainsText) {
      setNotice('No passed domains to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(passedDomainsText);
      setNotice('Passed domains copied to clipboard.');
    } catch {
      setNotice('Copy failed. Your browser blocked clipboard access.');
    }
  };

  const runCheck = async () => {
    if (!domainsText.trim()) {
      setError('Please paste at least one domain.');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);
    try {
      const payload = await startBulkDomainCheck({
        domains: domainsText,
        minResults,
      });
      setRunState(payload);
      setRunId(payload.runId);
      localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, payload.runId);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to start bulk domain check.');
    }
  };

  const stopRun = async () => {
    if (!runId) return;
    try {
      const payload = await stopBulkDomainCheck(runId);
      setRunState(payload);
      setNotice('Stop requested. The run will stop after current domain completes.');
    } catch (err) {
      setError(err.message || 'Failed to stop the run.');
    }
  };

  const clearRun = () => {
    setRunId('');
    setRunState(null);
    setError('');
    setNotice('');
    setDomainsText('');
    localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
    localStorage.removeItem(DOMAINS_TEXT_STORAGE_KEY);
  };

  const status = runState?.status || '';
  const runInProgress = status === 'running' || status === 'pending' || loading;

  const passedCount = runState?.passedCount || runState?.passed?.length || 0;
  const failedCount = runState?.failedCount || runState?.failed?.length || 0;
  const totalCount = runState?.total || 0;
  const currentCount = runState?.current || 0;
  const progressPct = totalCount ? Math.round((currentCount / totalCount) * 100) : 0;

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Bulk Domain Checker</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${domainCount > 5000 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
              {domainCount} domains
            </span>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Domains</label>
              <textarea
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                disabled={runInProgress}
                placeholder="Paste up to 5000 domains. One per line or comma separated."
                className="h-72 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Min indexed pages</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={minResults}
                  onChange={(e) => setMinResults(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={runCheck}
                disabled={runInProgress || !domainsText.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runInProgress ? 'Running...' : 'Run Bulk Check'}
              </button>
              <button
                type="button"
                onClick={stopRun}
                disabled={!runInProgress || !runId}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stop
              </button>
              <button
                type="button"
                onClick={clearRun}
                disabled={runInProgress}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>

            {runState && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <span className="font-semibold">Status: {status || 'pending'}</span>
                  <span>{currentCount}/{totalCount} processed</span>
                  <span>{progressPct}%</span>
                </div>
                {runState.activeDomain && <p className="font-mono text-xs text-slate-600">Now checking: {runState.activeDomain}</p>}
              </div>
            )}

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:h-[760px]">
            <div className="mb-4 grid gap-2 sm:grid-cols-4">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
              </div>
              <div className="rounded-md bg-indigo-50 p-3">
                <p className="text-xs uppercase tracking-wide text-indigo-700">Processed</p>
                <p className="text-2xl font-bold text-indigo-700">{currentCount}</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Passed</p>
                <p className="text-2xl font-bold text-emerald-700">{passedCount}</p>
              </div>
              <div className="rounded-md bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-700">Removed</p>
                <p className="text-2xl font-bold text-rose-700">{failedCount}</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyPassedDomains}
                disabled={passedCount === 0}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Copy Passed Domains
              </button>
              <button
                type="button"
                onClick={() => exportCsv([...(runState?.passed || []), ...(runState?.failed || [])], 'all-results.csv')}
                disabled={totalCount === 0}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Export All CSV
              </button>
              <button
                type="button"
                onClick={() => exportCsv(runState?.passed || [], 'passed-domains.csv')}
                disabled={passedCount === 0}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Export Passed CSV
              </button>
            </div>

            <div className="mb-4 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Live Results</p>
              <div className="space-y-1">
                {(runState?.recent || []).slice(-10).reverse().map((item) => (
                  <div key={`${item.domain}-${item.count}-${item.error || ''}`} className={`rounded px-2 py-1 text-xs ${item.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    <span className="font-mono">{item.domain}</span>
                    <span className="ml-2">{item.count} results</span>
                    {item.error ? <span className="ml-2">{item.error}</span> : null}
                  </div>
                ))}
                {(runState?.recent || []).length === 0 && <p className="text-xs text-slate-500">No results yet.</p>}
              </div>
            </div>

            <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-2">
              <ResultColumn title={`Passed (${passedCount})`} items={runState?.passed || []} tone="pass" />
              <ResultColumn title={`Removed (${failedCount})`} items={runState?.failed || []} tone="fail" />
            </div>
          </div>
        </div>
    </section>
  );
}

function ResultColumn({ title, items, tone }) {
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-md border ${tone === 'pass' ? 'border-emerald-200' : 'border-rose-200'}`}>
      <div className={`px-3 py-2 text-sm font-semibold ${tone === 'pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
        {title}
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">No domains</p>
        ) : (
          items.map((item) => (
            <div key={item.domain} className="border-t border-slate-100 px-3 py-2 text-xs">
              <p className="truncate font-mono text-slate-800">{item.domain}</p>
              <p className="text-slate-500">
                {item.count} results
                {item.error ? ` | ${item.error}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default BulkDomainCheckerPanel;
