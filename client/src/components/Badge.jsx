function Badge({ badge, selectedBrandColor, matchedBrand }) {
  if (badge === 'OWN') {
    return (
      <span
        className="inline-flex items-center rounded-md border-l-4 border-green-700 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700"
        style={{ borderLeftColor: selectedBrandColor || '#15803d' }}
      >
        OWN
      </span>
    );
  }

  if (badge === 'COMPETITOR') {
    return (
      <span className="inline-flex items-center gap-2 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
        COMPETITOR
        {matchedBrand && (
          <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: matchedBrand.color || '#dc2626' }}
            />
            {matchedBrand.code}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
      UNKNOWN
    </span>
  );
}

export default Badge;
