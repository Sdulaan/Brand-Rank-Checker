import { useEffect, useMemo, useState } from 'react';
import BrandSidebar from './components/BrandSidebar';
import CheckPanel from './components/CheckPanel';
import ResultsList from './components/ResultsList';
import { checkTopTen, getBrands } from './services/api';

function App() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [resultsByBrand, setResultsByBrand] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const list = await getBrands();
        setBrands(list);
        if (list.length > 0) {
          setSelectedBrand(list[0]);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    loadBrands();
  }, []);

  const selectedResult = useMemo(() => {
    if (!selectedBrand) return null;
    return resultsByBrand[selectedBrand._id] || null;
  }, [resultsByBrand, selectedBrand]);

  const runCheck = async ({ brandId, query }) => {
    setLoading(true);
    setError('');
    try {
      const response = await checkTopTen({ brandId, query });
      setResultsByBrand((prev) => ({
        ...prev,
        [brandId]: response,
      }));
    } catch (err) {
      setError(err.message || 'Failed to check SERP results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <BrandSidebar
        brands={brands}
        selectedBrandId={selectedBrand?._id}
        onSelect={setSelectedBrand}
      />

      <main className="flex-1">
        <CheckPanel
          selectedBrand={selectedBrand}
          onCheck={runCheck}
          loading={loading}
          error={error}
          resultEntry={selectedResult}
        />
        <section className="px-4 pb-6 lg:px-6">
          <ResultsList selectedBrand={selectedBrand} payload={selectedResult} />
        </section>
      </main>
    </div>
  );
}

export default App;
