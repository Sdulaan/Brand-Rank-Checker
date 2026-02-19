import { useMemo, useState } from 'react';
import { BRAND_MAP } from '../constants/brandMap';

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
    <aside className="w-full border-r border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:shrink-0">
      <h2 className="mb-3 text-lg font-semibold">Brands</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        placeholder="Search code or name..."
      />

      <div className="space-y-2 overflow-y-auto lg:max-h-[calc(100vh-150px)]">
        {filteredBrands.map((brand) => {
          const active = selectedBrandId === brand._id;
          const brandStyle = BRAND_MAP[brand.code];
          const circleColor = brandStyle?.color || brand.color || '#64748b';

          return (
            <button
              key={brand._id}
              type="button"
              onClick={() => onSelect(brand)}
              className={`w-full rounded-md border px-3 py-2 text-left transition ${active
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: circleColor }}
                />
                <span className="font-semibold uppercase text-indigo-700">{brand.code}</span>
              </div>
              <div className="mt-1 flex justify-end">
                {brandStyle ? (
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs font-semibold"
                    style={{ background: brandStyle.bg, color: brandStyle.text }}
                  >
                    {brand.name}
                  </span>
                ) : (
                  <p className="text-sm text-slate-700">{brand.name}</p>
                )}
              </div>
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