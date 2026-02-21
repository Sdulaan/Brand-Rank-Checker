import { useEffect, useState } from 'react';

const getActionBadgeClass = (action) => {
  if (action === 'auto_start') return 'bg-blue-100 text-blue-800';
  if (action === 'auto_stop') return 'bg-slate-200 text-slate-800';
  if (action === 'auto_check') return 'bg-indigo-100 text-indigo-800';
  return 'bg-slate-100 text-slate-700';
};

function AutoCheckLogPanel({ onLoadLogs }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await onLoadLogs(150);
      setLogs(list);
    } catch (err) {
      setError(err.message || 'Failed to load auto-check logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="p-3 lg:p-5">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Auto Check Logs</h2>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div className="overflow-auto rounded-md border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Brand</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((item) => (
                <tr key={item._id}>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getActionBadgeClass(item.action)}`}>
                      {item.action}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.brand?.code ? `${item.brand.code} - ${item.brand.name}` : '-'}</td>
                  <td className="px-3 py-2">
                    {item.metadata?.ok === true ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">success</span>
                    ) : item.metadata?.ok === false ? (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">failure</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{item.metadata?.source || '-'}</td>
                  <td className="px-3 py-2">{item.note || '-'}</td>
                  <td className="px-3 py-2 text-xs">
                    {item.actor?.username ? `${item.actor.username} (${item.actor.email})` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && logs.length === 0 && <p className="mt-3 text-xs text-slate-500">No auto-check logs yet.</p>}
      </div>
    </section>
  );
}

export default AutoCheckLogPanel;
