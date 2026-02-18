import { useEffect, useMemo, useState } from 'react';

const toExternalUrl = (domain) => {
  if (!domain) return '#';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
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

function DomainManagementPanel({ brands, onLoadDomains, onCreateDomain, onDeleteDomain }) {
  const [brandId, setBrandId] = useState('');
  const [domain, setDomain] = useState('');
  const [note, setNote] = useState('');
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!brandId && brands.length > 0) {
      setBrandId(brands[0]._id);
    }
  }, [brands, brandId]);

  const brandMap = useMemo(() => {
    return new Map(brands.map((item) => [item._id, item]));
  }, [brands]);

  const filteredDomains = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return domains;

    return domains.filter((item) => {
      const brand = item.brand || brandMap.get(item.brand);
      const brandText = `${brand?.code || ''} ${brand?.name || ''}`.toLowerCase();
      return item.domain?.toLowerCase().includes(q) || brandText.includes(q);
    });
  }, [domains, search, brandMap]);

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

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onCreateDomain({ domain, brandId, note });
      setDomain('');
      setNote('');
      await loadDomains();
    } catch (err) {
      setError(err.message || 'Failed to add domain');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    const target = domains.find((item) => item._id === id);
    const confirmed = window.confirm(
      `Delete domain "${target?.domain || ''}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setError('');
    try {
      await onDeleteDomain(id);
      await loadDomains();
    } catch (err) {
      setError(err.message || 'Failed to delete domain');
    }
  };

  return (
    <section className="p-3 lg:p-5">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Domain Management</h2>
          <p className="mt-1 text-xs text-slate-500">Add domain with brand and note.</p>

          <form onSubmit={submit} className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_1fr_auto]">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            >
              {brands.map((item) => (
                <option key={item._id} value={item._id}>
                  {formatBrandLabel(item)}
                </option>
              ))}
            </select>
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
              placeholder="Note"
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

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Domains</h3>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search domain or brand..."
                className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={loadDomains}
                disabled={loading}
                className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-md border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2 text-left">Domain</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Note</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDomains.map((item) => {
                  const brand = item.brand || brandMap.get(item.brand);
                  return (
                    <tr key={item._id}>
                      <td className="px-3 py-2 font-medium">
                        <a
                          href={toExternalUrl(item.domain)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 hover:underline"
                        >
                          {item.domain}
                        </a>
                      </td>
                      <td className="px-3 py-2">{formatBrandLabel(brand)}</td>
                      <td className="px-3 py-2">{item.note || '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => remove(item._id)}
                          className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filteredDomains.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">No domains found for this search.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default DomainManagementPanel;
