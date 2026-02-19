import { useEffect, useMemo, useState } from 'react';
import { BRAND_MAP } from '../constants/brandMap';

const RANGES = [
  { id: '1d', label: 'Past Day' },
  { id: '7d', label: '7 Days' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
];

const DOMAIN_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16',
];

const getTrendBadge = (trend, delta) => {
  if (trend === 'up') return { label: `↑ ${delta}`, className: 'bg-emerald-50 text-emerald-700' };
  if (trend === 'down') return { label: `↓ ${Math.abs(delta)}`, className: 'bg-rose-50 text-rose-700' };
  if (trend === 'stable') return { label: '→ Stable', className: 'bg-slate-100 text-slate-700' };
  return { label: 'No data', className: 'bg-slate-100 text-slate-500' };
};

const buildPoints = (points, width, height, rankField) => {
  if (!points.length) return '';
  return points
    .map((point, index) => {
      const rank = point[rankField];
      const x = points.length > 1 ? (index * width) / (points.length - 1) : width / 2;
      const y = ((rank - 1) / 10) * height;
      return `${x},${y}`;
    })
    .join(' ');
};

// ─── Searchable brand dropdown ────────────────────────────────────────────────
function BrandSearchDropdown({ brands, selectedIds, onAdd, placeholder = 'Search and add brand...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brands.filter(
      (b) =>
        !selectedIds.includes(b._id) &&
        (b.code?.toLowerCase().includes(q) || b.name?.toLowerCase().includes(q))
    );
  }, [brands, selectedIds, query]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.map((b) => {
            const bStyle = BRAND_MAP[b.code];
            return (
              <button
                key={b._id}
                type="button"
                onMouseDown={() => { onAdd(b); setQuery(''); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                <span
                  className="rounded px-2 py-0.5 text-xs font-bold"
                  style={bStyle
                    ? { background: bStyle.bg, color: bStyle.text }
                    : { backgroundColor: b.color || '#64748b', color: '#fff' }
                  }
                >
                  {b.code}
                </span>
                <span className="text-slate-500">— {b.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          No brands found.
        </div>
      )}
    </div>
  );
}

// ─── Brand vs Brand compare ───────────────────────────────────────────────────
function BrandCompare({ initialBrand, brands, onGetRankingHistory }) {
  const [range, setRange] = useState('7d');
  const [selectedBrands, setSelectedBrands] = useState([initialBrand]);
  const [dataMap, setDataMap] = useState({});
  const [loadingIds, setLoadingIds] = useState([]);

  const svgWidth = 720;
  const svgHeight = 220;

  const loadBrandData = async (brand) => {
    setLoadingIds((prev) => [...prev, brand._id]);
    try {
      const result = await onGetRankingHistory(brand._id, range);
      setDataMap((prev) => ({ ...prev, [brand._id]: result }));
    } catch (err) {
      console.error('Failed to load analytics for', brand.code, err);
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== brand._id));
    }
  };

  useEffect(() => {
    selectedBrands.forEach((b) => loadBrandData(b));
  }, [range]);

  const addBrand = (brand) => {
    setSelectedBrands((prev) => [...prev, brand]);
    loadBrandData(brand);
  };

  const removeBrand = (brandId) => {
    if (selectedBrands.length <= 1) return;
    setSelectedBrands((prev) => prev.filter((b) => b._id !== brandId));
    setDataMap((prev) => { const n = { ...prev }; delete n[brandId]; return n; });
  };

  const summaryRows = selectedBrands.map((b) => {
    const data = dataMap[b._id];
    const points = (data?.points || []).filter((p) => p.bestOwnRank !== null);
    const latest = points[points.length - 1];
    const previous = points[points.length - 2];
    return {
      brand: b,
      currentRank: latest?.bestOwnRank ?? null,
      previousRank: previous?.bestOwnRank ?? null,
      trend: data?.trend || null,
      delta: data?.delta ?? null,
    };
  });

  return (
    <div className="space-y-4 p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                range === r.id ? 'bg-black text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="ml-auto w-64">
          <BrandSearchDropdown
            brands={brands}
            selectedIds={selectedBrands.map((b) => b._id)}
            onAdd={addBrand}
            placeholder="Add brand to compare..."
          />
        </div>
      </div>

      {/* Selected brand pills */}
      <div className="flex flex-wrap gap-2">
        {selectedBrands.map((b) => {
          const bStyle = BRAND_MAP[b.code];
          return (
            <div
              key={b._id}
              className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold shadow-sm"
              style={bStyle
                ? { background: bStyle.bg, color: bStyle.text }
                : { backgroundColor: b.color || '#64748b', color: '#fff' }
              }
            >
              {b.code}
              {selectedBrands.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBrand(b._id)}
                  className="ml-1 opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {loadingIds.length > 0 && (
          <span className="text-xs text-slate-500 self-center">Loading data...</span>
        )}
      </div>

      {/* Graph */}
      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Rank Over Time (lower = better)</h3>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-56 w-full min-w-[600px]">
            {[1, 3, 5, 7, 10].map((rank) => {
              const y = ((rank - 1) / 10) * svgHeight;
              return (
                <g key={rank}>
                  <line x1="0" y1={y} x2={svgWidth} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x="4" y={Math.max(12, y - 4)} fill="#94a3b8" fontSize="11">#{rank}</text>
                </g>
              );
            })}

            {selectedBrands.map((b) => {
              const bStyle = BRAND_MAP[b.code];
              const data = dataMap[b._id];
              const points = (data?.points || []).filter((p) => p.bestOwnRank !== null);
              if (!points.length) return null;
              const polyline = buildPoints(points, svgWidth, svgHeight, 'bestOwnRank');
              const color = bStyle?.color || b.color || '#64748b';
              return (
                <g key={b._id}>
                  <polyline fill="none" stroke={color} strokeWidth="2.5" points={polyline} />
                  {points.map((point, index) => {
                    const x = points.length > 1 ? (index * svgWidth) / (points.length - 1) : svgWidth / 2;
                    const y = ((point.bestOwnRank - 1) / 10) * svgHeight;
                    return <circle key={index} cx={x} cy={y} r="4" fill={color} />;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <h3 className="text-sm font-semibold">Brand Summary</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-2 text-left">Brand</th>
              <th className="px-4 py-2 text-left">Current Rank</th>
              <th className="px-4 py-2 text-left">Previous Rank</th>
              <th className="px-4 py-2 text-left">Movement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summaryRows.map(({ brand, currentRank, previousRank, trend, delta }) => {
              const badge = getTrendBadge(trend, delta);
              const bStyle = BRAND_MAP[brand.code];
              return (
                <tr key={brand._id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold"
                        style={bStyle
                          ? { background: bStyle.bg, color: bStyle.text }
                          : { backgroundColor: brand.color || '#64748b', color: '#fff' }
                        }
                      >
                        {brand.code}
                      </span>
                      <span className="text-xs text-slate-500">— {brand.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-semibold">{currentRank ?? '-'}</td>
                  <td className="px-4 py-2">{previousRank ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Domain vs Domain compare ─────────────────────────────────────────────────
function DomainCompare({ selectedBrand, domainItems, allDomains, onGetRankingHistory }) {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compareDomains, setCompareDomains] = useState(domainItems);

  const svgWidth = 720;
  const svgHeight = 220;

  useEffect(() => {
    if (!selectedBrand?._id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await onGetRankingHistory(selectedBrand._id, range);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedBrand?._id, range]);

  const addDomain = (domain) => {
    if (!compareDomains.find((d) => d._id === domain._id)) {
      setCompareDomains((prev) => [...prev, domain]);
    }
  };

  const removeDomain = (id) => {
    if (compareDomains.length <= 1) return;
    setCompareDomains((prev) => prev.filter((d) => d._id !== id));
  };

  const availableDomains = allDomains.filter(
    (d) => !compareDomains.find((c) => c._id === d._id)
  );

  const domainTrendMap = useMemo(() => {
    const map = {};
    (data?.domainTrends || []).forEach((t) => { map[t.domain] = t; });
    return map;
  }, [data]);

  return (
    <div className="space-y-4 p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                range === r.id ? 'bg-black text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {availableDomains.length > 0 && (
          <div className="ml-auto w-64">
            <select
              onChange={(e) => {
                const d = availableDomains.find((x) => x._id === e.target.value);
                if (d) addDomain(d);
                e.target.value = '';
              }}
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>Add domain to compare...</option>
              {availableDomains.map((d) => (
                <option key={d._id} value={d._id}>{d.domain}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Selected domain pills */}
      <div className="flex flex-wrap gap-2">
        {compareDomains.map((d, index) => {
          const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];
          return (
            <div
              key={d._id}
              className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
              style={{ borderColor: color, color, backgroundColor: `${color}15` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {d.domain}
              {compareDomains.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDomain(d._id)}
                  className="ml-1 text-slate-400 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {loading && <span className="text-xs text-slate-500 self-center">Loading...</span>}
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {/* Graph */}
      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Domain Rank Over Time (lower = better)</h3>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-56 w-full min-w-[600px]">
            {[1, 3, 5, 7, 10].map((rank) => {
              const y = ((rank - 1) / 10) * svgHeight;
              return (
                <g key={rank}>
                  <line x1="0" y1={y} x2={svgWidth} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x="4" y={Math.max(12, y - 4)} fill="#94a3b8" fontSize="11">#{rank}</text>
                </g>
              );
            })}
            {compareDomains.map((d, index) => {
              const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];
              const trend = domainTrendMap[d.domain];
              const points = (trend?.points || []).filter((p) => p.rank !== null);
              if (!points.length) return null;
              const polyline = buildPoints(points, svgWidth, svgHeight, 'rank');
              return (
                <g key={d._id}>
                  <polyline fill="none" stroke={color} strokeWidth="2.5" points={polyline} />
                  {points.map((point, i) => {
                    const x = points.length > 1 ? (i * svgWidth) / (points.length - 1) : svgWidth / 2;
                    const y = ((point.rank - 1) / 10) * svgHeight;
                    return <circle key={i} cx={x} cy={y} r="4" fill={color} />;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <h3 className="text-sm font-semibold">Domain Summary</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-2 text-left">Domain</th>
              <th className="px-4 py-2 text-left">Current Rank</th>
              <th className="px-4 py-2 text-left">Previous Rank</th>
              <th className="px-4 py-2 text-left">Movement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {compareDomains.map((d, index) => {
              const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];
              const trend = domainTrendMap[d.domain];
              const badge = getTrendBadge(trend?.trend, trend?.delta);
              return (
                <tr key={d._id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium" style={{ color }}>{d.domain}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-semibold">{trend?.currentRank ?? '-'}</td>
                  <td className="px-4 py-2">{trend?.previousRank ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
function ComparePanel({ mode, selectedBrand, brands, domainItems, allDomains, onGetRankingHistory }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {mode === 'brand' ? (
        <BrandCompare
          initialBrand={selectedBrand}
          brands={brands}
          onGetRankingHistory={onGetRankingHistory}
        />
      ) : (
        <DomainCompare
          selectedBrand={selectedBrand}
          domainItems={domainItems}
          allDomains={allDomains}
          onGetRankingHistory={onGetRankingHistory}
        />
      )}
    </div>
  );
}

export default ComparePanel;