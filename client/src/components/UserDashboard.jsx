import { useEffect, useMemo, useState } from 'react';
import { BRAND_MAP } from '../constants/brandMap';

function StatCard({ emoji, value, label, color = '#f59e0b' }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <span className="text-3xl">{emoji}</span>
      <span className="text-3xl font-bold" style={{ color }}>{value ?? 0}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}

const formatRunTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function BrandCarouselCard({ brand, active, selectedRunId, onSelectRun }) {
  const bStyle = BRAND_MAP[brand.code];
  const bg = bStyle?.bg || brand.color || '#64748b';
  const textColor = bStyle?.text || '#fff';

  const rankBadge = brand.currentRank ? { label: `#${brand.currentRank}` } : { label: 'No data' };

  const trendBadge =
    brand.trend === 'up'
      ? { label: `Up ${brand.delta}`, bg: 'rgba(52,211,153,0.25)', color: textColor }
      : brand.trend === 'down'
      ? { label: `Down ${Math.abs(brand.delta)}`, bg: 'rgba(251,113,133,0.25)', color: textColor }
      : { label: 'Stable', bg: 'rgba(255,255,255,0.15)', color: textColor };

  const recentRuns = brand.recentAutoChecks || [];

  return (
    <div
      className="select-none rounded-2xl p-6 shadow-lg transition-all duration-300"
      style={{
        background: bg,
        opacity: active ? 1 : 0.5,
        transform: active ? 'scale(1)' : 'scale(0.92)',
        minHeight: '270px',
        color: textColor,
      }}
    >
      <span className="text-2xl font-extrabold tracking-wide" style={{ color: textColor }}>
        {brand.code}
      </span>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: textColor }}>
          {rankBadge.label}
        </span>
        <span className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: trendBadge.bg, color: trendBadge.color }}>
          {trendBadge.label}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: textColor, opacity: 0.85 }}>
          Last 5 Auto Checks
        </p>

        {recentRuns.length === 0 ? (
          <p className="mt-2 text-xs" style={{ color: textColor, opacity: 0.72 }}>No auto checks yet</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {recentRuns.map((run) => {
              const isSelected = selectedRunId === run._id;
              const rankLabel = run.bestOwnRank ? `#${run.bestOwnRank}` : '-';

              return (
                <button
                  key={run._id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRun(brand, run);
                  }}
                  className="rounded-md px-2 py-1 text-left text-[11px] font-semibold transition"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)',
                    color: textColor,
                    border: isSelected ? '1px solid rgba(255,255,255,0.7)' : '1px solid transparent',
                  }}
                  title={`Best rank: ${rankLabel} | Own: ${run.ownCount ?? 0}`}
                >
                  <span>{formatRunTime(run.checkedAt)}</span>
                  <span className="ml-1 opacity-80">{rankLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

function BrandCarousel({ brands, selectedRunId, onSelectRun }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= brands.length) setIndex(0);
  }, [brands.length, index]);

  if (!brands.length) return null;

  const prev = () => setIndex((i) => (i - 1 + brands.length) % brands.length);
  const next = () => setIndex((i) => (i + 1) % brands.length);
  const getCard = (offset) => brands[(index + offset + brands.length) % brands.length];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={prev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 shadow transition hover:bg-slate-50"
        >
          {'<'}
        </button>

        <div className="hidden flex-1 grid-cols-3 items-center gap-4 lg:grid">
          <div className="cursor-pointer" onClick={prev}>
            <BrandCarouselCard brand={getCard(-1)} active={false} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
          </div>
          <BrandCarouselCard brand={getCard(0)} active={true} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
          <div className="cursor-pointer" onClick={next}>
            <BrandCarouselCard brand={getCard(1)} active={false} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
          </div>
        </div>

        <div className="flex-1 lg:hidden">
          <BrandCarouselCard brand={getCard(0)} active={true} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
        </div>

        <button
          type="button"
          onClick={next}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 shadow transition hover:bg-slate-50"
        >
          {'>'}
        </button>
      </div>

      <div className="flex justify-center gap-1.5">
        {brands.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === index ? '20px' : '8px',
              height: '8px',
              backgroundColor: i === index ? '#6366f1' : '#cbd5e1',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RunSummary({ selected }) {
  if (!selected?.brand || !selected?.run) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
        Click one of the recent auto-check chips in a brand card to view run summary.
      </div>
    );
  }

  const { brand, run } = selected;
  const results = run.results || [];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-slate-800">Selected Auto-Check Summary</h3>
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{brand.code}</span>
        <span className="text-xs text-slate-500">{new Date(run.checkedAt).toLocaleString()}</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Best Own Rank</p>
          <p className="mt-1 text-lg font-semibold">{run.bestOwnRank ?? '-'}</p>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Own</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{run.ownCount ?? 0}</p>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Competitor</p>
          <p className="mt-1 text-lg font-semibold text-rose-700">{run.competitorCount ?? 0}</p>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Unknown</p>
          <p className="mt-1 text-lg font-semibold text-slate-700">{run.unknownCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">Domain</th>
              <th className="px-3 py-2 text-left">Badge</th>
              <th className="px-3 py-2 text-left">Title</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.slice(0, 10).map((row, idx) => (
              <tr key={`${row.rank}-${idx}`}>
                <td className="px-3 py-2 font-semibold">#{row.rank}</td>
                <td className="px-3 py-2">{row.domainHost || '-'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      row.badge === 'OWN'
                        ? 'bg-emerald-100 text-emerald-700'
                        : row.badge === 'COMPETITOR'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {row.badge}
                  </span>
                </td>
                <td className="px-3 py-2">{row.title || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDashboard({ username = 'User', brands = [], totalDomains = 0 }) {
  const totalBrands = brands.length;
  const searchedToday = brands.filter((b) => b.lastChecked).length;
  const inTop10 = brands.filter((b) => b.currentRank !== null && b.currentRank <= 10).length;
  const rankedFirst = brands.filter((b) => b.currentRank === 1).length;
  const [brandSearch, setBrandSearch] = useState('');

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((brand) => {
      const code = String(brand.code || '').toLowerCase();
      const name = String(brand.name || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [brands, brandSearch]);

  const firstSelectable = useMemo(() => {
    for (const brand of filteredBrands) {
      if ((brand.recentAutoChecks || []).length) {
        return { brand, run: brand.recentAutoChecks[0] };
      }
    }
    return null;
  }, [filteredBrands]);

  const [selectedRun, setSelectedRun] = useState(null);

  useEffect(() => {
    setSelectedRun(firstSelectable);
  }, [firstSelectable]);

  const selectedRunId = selectedRun?.run?._id || '';

  return (
    <section className="min-h-screen w-full space-y-4 overflow-hidden bg-slate-100 p-4 lg:p-6">
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Welcome back, {username}!</h1>
          <p className="mt-0.5 text-sm text-slate-500">Here is what is happening with your brands today.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">{username}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard emoji="T" value={totalBrands} label="Total Brands" color="#f59e0b" />
        <StatCard emoji="D" value={totalDomains} label="Total Domains" color="#6366f1" />
        <StatCard emoji="S" value={searchedToday} label="Searched Today" color="#f59e0b" />
        <StatCard emoji="10" value={inTop10} label="In Top 10" color="#10b981" />
        <StatCard emoji="1" value={rankedFirst} label="Ranked #1" color="#8b5cf6" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800">Brand Status Overview</h2>
          <input
            value={brandSearch}
            onChange={(e) => setBrandSearch(e.target.value)}
            placeholder="Search brand code/name..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-72"
          />
        </div>
        {filteredBrands.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="font-semibold text-slate-700">No brands added yet.</p>
            <p className="text-sm text-slate-400">
              {brands.length === 0
                ? 'Go to Brand Management to add your first brand.'
                : 'No brands match your search.'}
            </p>
          </div>
        ) : (
          <BrandCarousel
            brands={filteredBrands}
            selectedRunId={selectedRunId}
            onSelectRun={(brand, run) => setSelectedRun({ brand, run })}
          />
        )}
      </div>

      <RunSummary selected={selectedRun} />
    </section>
  );
}

export default UserDashboard;
