import { useEffect, useMemo, useState } from 'react';
import AnalyticsPanel from './AnalyticsPanel';

const toExternalUrl = (domain) => {
  if (!domain) return '#';
  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain;
  return `https://${domain}`;
};

const formatBrandLabel = (brand) => {
  if (!brand) return '-';
  const code = String(brand.code || '').trim();
  const name = String(brand.name || '').trim();
  if (!code && !name) return '-';
  if (!code) return name;
  if (!name) return code;
  if (code.toLowerCase() === name.toLowerCase()) return code;
  return `${code} - ${name}`;
};

// ─── Add-domain form ──────────────────────────────────────────────────────────
function AddDomainForm({ selectedBrand, onCreateDomain, onRefresh }) {
  const [domain, setDomain] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onCreateDomain({ domain, brandId: selectedBrand._id, note });
      setDomain('');
      setNote('');
      await onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to add domain');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Add Domain</h2>
      <p className="mt-1 text-xs text-slate-500">Associate a domain with a brand.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_1fr_auto]">
        <div className="flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: selectedBrand?.color || '#64748b' }}
          />
          <span className="truncate text-sm font-semibold text-indigo-700">
            {selectedBrand ? formatBrandLabel(selectedBrand) : 'No brand selected'}
          </span>
        </div>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Adding...' : 'Add Domain'}
        </button>
      </form>
      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

// ─── Domain card ──────────────────────────────────────────────────────────────
function DomainCard({ item, isSelected, onSelect, onDelete }) {
  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 transition ${isSelected
        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
        : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}
      onClick={() => onSelect(item)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={toExternalUrl(item.domain)}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-medium text-indigo-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.domain}
          </a>
          {item.note && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{item.note}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item._id);
          }}
          className="shrink-0 rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Analytics panel wrapper (brand-level or domain-level) ───────────────────
function AnalyticsInline({ brand, domainItem, onGetRankingHistory }) {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!brand?._id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await onGetRankingHistory(brand._id, range);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [brand?._id, range]);

  // If a specific domain is focused, filter domainTrends to that domain only
  const displayData = useMemo(() => {
    if (!data) return null;
    if (!domainItem) return data; // brand-level: show all domains
    const domainHost = domainItem.domain;
    const filteredTrends = (data.domainTrends || []).filter(
      (t) => t.domain === domainHost || t.domainHostKey?.includes(domainHost)
    );
    return { ...data, domainTrends: filteredTrends };
  }, [data, domainItem]);

  return (
    <AnalyticsPanel
      selectedBrand={brand}
      data={displayData}
      range={range}
      onRangeChange={setRange}
      loading={loading}
      error={error}
      focusedDomain={domainItem?.domain || null}
    />
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
function DomainManagementPanel({
  brands,
  selectedBrand,
  isAdmin,
  onLoadDomains,
  onCreateDomain,
  onDeleteDomain,
  onGetRankingHistory,
}) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // null = no analytics; 'brand' = brand-level; domain object = domain-level
  const [analyticsTarget, setAnalyticsTarget] = useState(null);

  // Clear selections when brand changes
  useEffect(() => {
    setAnalyticsTarget(isAdmin ? 'brand' : null);
    setSearch('');
  }, [selectedBrand?._id]);

  const loadDomains = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await onLoadDomains();
      setDomains(list);
    } catch (err) {
      setError(err.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const remove = async (id) => {
    const target = domains.find((item) => item._id === id);
    if (!window.confirm(`Delete domain "${target?.domain || ''}"? This cannot be undone.`)) return;
    try {
      await onDeleteDomain(id);
      if (analyticsTarget && analyticsTarget !== 'brand' && analyticsTarget._id === id) {
        setAnalyticsTarget(null);
      }
      await loadDomains();
    } catch (err) {
      setError(err.message || 'Failed to delete domain');
    }
  };

  const brandDomains = useMemo(() => {
    if (!selectedBrand) return [];
    const q = search.trim().toLowerCase();
    return domains.filter((d) => {
      const brandId = typeof d.brand === 'object' ? d.brand?._id : d.brand;
      if (brandId !== selectedBrand._id) return false;
      if (!q) return true;
      return d.domain?.toLowerCase().includes(q) || (d.note || '').toLowerCase().includes(q);
    });
  }, [domains, selectedBrand, search]);

  const handleBrandHeaderClick = () => {
    if (!isAdmin) return;
    // Toggle brand analytics — clicking again closes it
    setAnalyticsTarget((prev) => (prev === 'brand' ? null : 'brand'));
  };

  const handleDomainSelect = (domainItem) => {
    if (!isAdmin) return;
    setAnalyticsTarget((prev) =>
      prev !== 'brand' && prev?._id === domainItem._id ? null : domainItem
    );
  };

  // Determine what to show in the analytics panel
  const analyticsIsBrand = analyticsTarget === 'brand';
  const analyticsIsDomain = analyticsTarget && analyticsTarget !== 'brand';
  const showAnalytics = isAdmin && (analyticsIsBrand || analyticsIsDomain);

  const analyticsLabel = analyticsIsBrand
    ? `${selectedBrand?.code} `
    : analyticsIsDomain
      ? analyticsTarget.domain
      : '';

  return (
    <section className="p-3 lg:p-5 space-y-4">
      {/* Add domain form — admin only */}
      {isAdmin && (
   <AddDomainForm
  selectedBrand={selectedBrand}
  onCreateDomain={onCreateDomain}
  onRefresh={loadDomains}
/>
      )}

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {selectedBrand ? (
        <div className="space-y-4">
          {/* Two-column layout: domains list | analytics */}
          <div className="flex gap-4 min-h-[70vh]">

            {/* ── Domain vertical list ── */}
            <div className="w-72 shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleBrandHeaderClick}
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${isAdmin
                    ? analyticsIsBrand
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-indigo-600 hover:text-white'
                    : 'text-slate-800 cursor-default'
                    }`}
                >
                  {selectedBrand.code}
                </button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 shrink-0">
                  {brandDomains.length}
                </span>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search domains..."
                className="mb-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={loadDomains}
                disabled={loading}
                className="mb-3 w-full rounded bg-slate-100 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>

              {brandDomains.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  {loading ? 'Loading…' : 'No domains yet.'}
                </p>
              ) : (
                <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-320px)]">
                  {brandDomains.map((item) => {
                    const isSelected = analyticsIsDomain && analyticsTarget?._id === item._id;
                    return (
                      <div
                        key={item._id}
                        onClick={() => handleDomainSelect(item)}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition ${isSelected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-400" />

                        <a href={toExternalUrl(item.domain)}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium text-indigo-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.domain}
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Analytics panel ── */}
            <div className="flex-1 min-w-0">
              {showAnalytics ? (
                <div className="rounded-lg border border-indigo-200 bg-white shadow-sm overflow-hidden h-full">
                  <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 shadow-sm">
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                        {analyticsIsBrand ? 'Brand Analytics' : 'Domain Analytics'}
                      </span>
                      <span className="h-4 w-px bg-indigo-400" />
                      <span className="text-base font-bold text-white">{analyticsLabel}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {analyticsIsDomain && (
                        <button
                          type="button"
                          onClick={() => remove(analyticsTarget._id)}
                          className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                        >
                          Delete Domain
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAnalyticsTarget(null)}
                        className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <AnalyticsInline
                    brand={selectedBrand}
                    domainItem={analyticsIsDomain ? analyticsTarget : null}
                    onGetRankingHistory={onGetRankingHistory}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                  Select a domain or click the brand name to view analytics.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
          Select a brand from the sidebar to view its domains.
        </div>
      )}
    </section>
  );
}

export default DomainManagementPanel;