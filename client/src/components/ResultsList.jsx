import Badge from './Badge';

function ResultsList({ selectedBrand, payload }) {
  if (!payload) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Select a brand and run a check to view top 10 results.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">#</th>
            <th className="px-4 py-3 text-left font-semibold">Title & Link</th>
            <th className="px-4 py-3 text-left font-semibold">Domain</th>
            <th className="px-4 py-3 text-left font-semibold">Badge</th>
            <th className="px-4 py-3 text-left font-semibold">Debug</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payload.results.map((row) => (
            <tr key={`${row.rank}-${row.link}`}>
              <td className="px-4 py-3 font-semibold">{row.rank}</td>
              <td className="px-4 py-3">
                <a
                  href={row.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {row.title}
                </a>
                <p className="mt-1 truncate text-xs text-slate-500">{row.link}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{row.domainHost || '-'}</td>
              <td className="px-4 py-3">
                <Badge
                  badge={row.badge}
                  selectedBrandColor={selectedBrand?.color}
                  matchedBrand={row.matchedBrand}
                />
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                <p>matchType: {row.matchType}</p>
                <p>matchedDomain: {row.matchedDomain?.domain || '-'}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResultsList;
