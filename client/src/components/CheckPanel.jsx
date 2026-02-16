import { useEffect, useState } from 'react';

function CheckPanel({ selectedBrand, onCheck, loading, error, resultEntry }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery(selectedBrand?.code || selectedBrand?.name || '');
  }, [selectedBrand]);

  return (
    <section className="flex-1 p-4 lg:p-6">
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Top 10 Checker (Google Indonesia)</h1>
        <p className="mt-1 text-sm text-slate-500">gl=id · hl=id · source: SerpApi</p>

        {selectedBrand ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Query</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Use brand code by default"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => onCheck({ brandId: selectedBrand._id, query })}
              className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Checking...' : 'Check Top 10'}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Select a brand from the sidebar.</p>
        )}

        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-indigo-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
            Loading SERP results...
          </div>
        )}

        {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        {resultEntry?.checkedAt && (
          <p className="mt-3 text-xs text-slate-500">
            Last checked at: {new Date(resultEntry.checkedAt).toLocaleString()}
            {resultEntry.cached ? ' (cached)' : ''}
          </p>
        )}
      </div>
    </section>
  );
}

export default CheckPanel;
