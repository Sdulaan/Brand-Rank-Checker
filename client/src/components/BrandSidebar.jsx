import { useMemo, useState } from 'react';

function BrandSidebar({ brands, selectedBrandId, onSelect }) {
  const [search, setSearch] = useState('');

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;

    return brands.filter((brand) =>
      [brand.code, brand.name].some((part) => part?.toLowerCase().includes(q))
    );
  }, [brands, search]);

  return (
    <aside className="w-full border-r border-slate-200 bg-white p-4 lg:w-80">
      <h2 className="mb-3 text-lg font-semibold">Brands</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        placeholder="Search code or name..."
      />

      <div className="space-y-2 overflow-y-auto lg:max-h-[calc(100vh-180px)]">
        {filteredBrands.map((brand) => {
          const active = selectedBrandId === brand._id;
          return (
            <button
              key={brand._id}
              type="button"
              onClick={() => onSelect(brand)}
              className={`w-full rounded-md border px-3 py-2 text-left transition ${
                active
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: brand.color || '#64748b' }}
                />
                <span className="font-semibold uppercase text-indigo-700">{brand.code}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{brand.name}</p>
            </button>
          );
        })}

        {filteredBrands.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            No brands found.
          </p>
        )}
      </div>
    </aside>
  );
}

export default BrandSidebar;
