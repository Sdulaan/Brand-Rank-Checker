import { useEffect, useMemo, useState } from 'react';

function StatusBadge({ badge, selectedBrand }) {
  if (badge.type === 'OWN') {
    return (
      <span
        className="inline-flex items-center rounded border-l-4 px-2 py-1 text-xs font-semibold text-green-700 bg-green-50"
        style={{ borderColor: selectedBrand?.color || '#16a34a' }}
      >
        OWN
      </span>
    );
  }

  if (badge.type === 'COMPETITOR') {
    return (
      <span
        className="inline-flex items-center rounded border-l-4 px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50"
        style={{ borderColor: badge.brand.color }}
      >
        COMPETITOR · {badge.brand.code}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
      UNKNOWN
    </span>
  );
}

export default function App() {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const response = await fetch('/api/brands?active=true');
        if (!response.ok) throw new Error('Failed to load brands');
        const data = await response.json();
        setBrands(data);
        if (data.length > 0) {
          setSelectedBrandId(data[0]._id);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    loadBrands();
  }, []);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand._id === selectedBrandId),
    [brands, selectedBrandId]
  );

  const handleCheck = async () => {
    if (!selectedBrandId) {
      setError('Please select a brand first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/serp/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brandId: selectedBrandId,
          query: query.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check SERP');
      }

      setResults(data.results || []);
      setMeta({
        brand: data.brand,
        query: data.query,
        cached: data.cached
      });
    } catch (err) {
      setError(err.message);
      setResults([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">SERP Checker (Indonesia)</h1>
          <p className="mt-1 text-sm text-slate-600">Manual top-10 check with OWN / COMPETITOR / UNKNOWN labels.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr,auto]">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Brand</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={selectedBrandId}
                onChange={(event) => setSelectedBrandId(event.target.value)}
              >
                {brands.map((brand) => (
                  <option key={brand._id} value={brand._id}>
                    {brand.code} · {brand.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Query (optional)</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder={selectedBrand?.code || 'Type keyword'}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <button
              type="button"
              onClick={handleCheck}
              disabled={loading || !selectedBrandId}
              className="self-end rounded-md bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {loading ? 'Checking...' : 'Check Google Top 10'}
            </button>
          </div>

          {selectedBrand && (
            <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedBrand.color }} />
              Selected: {selectedBrand.code} - {selectedBrand.name}
            </div>
          )}

          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top 10 Results</h2>
            {meta && (
              <span className="text-sm text-slate-500">
                Query: <strong>{meta.query}</strong> {meta.cached ? '(cached)' : ''}
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-slate-500">No results yet. Select a brand and run a check.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Rank</th>
                    <th className="px-3 py-2 font-semibold">Title</th>
                    <th className="px-3 py-2 font-semibold">Domain</th>
                    <th className="px-3 py-2 font-semibold">Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((row) => (
                    <tr key={`${row.rank}-${row.link}`}>
                      <td className="px-3 py-3">{row.rank}</td>
                      <td className="px-3 py-3">
                        <a href={row.link} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                          {row.title}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{row.domainKey || row.hostname || '-'}</td>
                      <td className="px-3 py-3">
                        <StatusBadge badge={row.badge} selectedBrand={selectedBrand} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
