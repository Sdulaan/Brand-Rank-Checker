import { useEffect, useState } from 'react';

const toExternalUrl = (domain) => {
  if (!domain) return '#';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  return `https://${domain}`;
};

function DomainActivityLogPanel({ onLoadLogs }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await onLoadLogs(100);
      setLogs(list);
    } catch (err) {
      setError(err.message || 'Failed to load domain logs');
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
          <h2 className="text-lg font-semibold">Domain Activity Logs</h2>
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
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">Brand</th>
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
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        item.action === 'add' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.action}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={toExternalUrl(item.domain)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {item.domain}
                    </a>
                  </td>
                  <td className="px-3 py-2">{item.brand?.code ? `${item.brand.code} - ${item.brand.name}` : '-'}</td>
                  <td className="px-3 py-2">{item.note || '-'}</td>
                  <td className="px-3 py-2 text-xs">
                    {item.actor?.username ? `${item.actor.username} (${item.actor.email})` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && logs.length === 0 && <p className="mt-3 text-xs text-slate-500">No logs yet.</p>}
      </div>
    </section>
  );
}

export default DomainActivityLogPanel;
