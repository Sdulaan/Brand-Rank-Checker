import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import BrandSidebar from './components/BrandSidebar';
import CheckPanel from './components/CheckPanel';
import ResultsList from './components/ResultsList';
import AnalyticsPanel from './components/AnalyticsPanel';
import AdminPanel from './components/AdminPanel';
import {
  addAdminApiKey,
  checkTopTen,
  deleteAdminApiKey,
  getAdminDashboard,
  getBrands,
  getRankingHistory,
  runAutoNow,
  stopAutoRun,
  updateAdminApiKey,
  updateAdminSchedule,
} from './services/api';

const TABS = [
  { id: 'checker', label: 'Manual Checker' },
  { id: 'analytics', label: 'Ranking Analytics' },
  { id: 'admin', label: 'Admin Config' },
];

function App() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
  const [tab, setTab] = useState('checker');
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [resultsByBrand, setResultsByBrand] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [analyticsRange, setAnalyticsRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const [adminDashboard, setAdminDashboard] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [autoRunActionLoading, setAutoRunActionLoading] = useState(false);

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

  const runCheck = async ({ brandId, query, country, language }) => {
    setLoading(true);
    setError('');
    try {
      const response = await checkTopTen({ brandId, query, country, language });
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

  useEffect(() => {
    const loadAnalytics = async () => {
      if (tab !== 'analytics' || !selectedBrand?._id) return;
      setAnalyticsLoading(true);
      setAnalyticsError('');
      try {
        const data = await getRankingHistory(selectedBrand._id, analyticsRange);
        setAnalyticsData(data);
      } catch (err) {
        setAnalyticsError(err.message || 'Failed to load analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [tab, selectedBrand?._id, analyticsRange]);

  const refreshAdminDashboard = async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setAdminLoading(true);
    }
    setAdminError('');
    try {
      const data = await getAdminDashboard();
      setAdminDashboard(data);
    } catch (err) {
      setAdminError(err.message || 'Failed to load admin dashboard');
    } finally {
      if (showLoader) {
        setAdminLoading(false);
      }
    }
  };

  useEffect(() => {
    if (tab === 'admin') {
      refreshAdminDashboard({ showLoader: true });
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== 'admin') return undefined;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    const onDashboardUpdated = () => {
      refreshAdminDashboard({ showLoader: false });
    };

    socket.on('admin:dashboard-updated', onDashboardUpdated);

    return () => {
      socket.off('admin:dashboard-updated', onDashboardUpdated);
      socket.disconnect();
    };
  }, [tab, socketUrl]);

  const saveSchedule = async (payload) => {
    try {
      await updateAdminSchedule(payload);
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to update schedule');
    }
  };

  const addApiKey = async (payload) => {
    try {
      await addAdminApiKey(payload);
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to add API key');
    }
  };

  const updateApiKey = async (keyId, payload) => {
    try {
      await updateAdminApiKey(keyId, payload);
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to update API key');
    }
  };

  const removeApiKey = async (keyId) => {
    try {
      await deleteAdminApiKey(keyId);
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to delete API key');
    }
  };

  const triggerAutoRun = async () => {
    setAutoRunActionLoading(true);
    try {
      await runAutoNow();
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to run auto check now');
    } finally {
      setAutoRunActionLoading(false);
    }
  };

  const triggerStopAutoRun = async () => {
    setAutoRunActionLoading(true);
    try {
      await stopAutoRun();
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to stop auto check');
    } finally {
      setAutoRunActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <BrandSidebar brands={brands} selectedBrandId={selectedBrand?._id} onSelect={setSelectedBrand} />

      <main className="flex-1">
        <header className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'checker' && (
          <>
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
          </>
        )}

        {tab === 'analytics' && (
          <AnalyticsPanel
            selectedBrand={selectedBrand}
            data={analyticsData}
            range={analyticsRange}
            onRangeChange={setAnalyticsRange}
            loading={analyticsLoading}
            error={analyticsError}
          />
        )}

        {tab === 'admin' && (
          <AdminPanel
            dashboard={adminDashboard}
            loading={adminLoading}
            error={adminError}
            onSaveSchedule={saveSchedule}
            onAddKey={addApiKey}
            onUpdateKey={updateApiKey}
            onDeleteKey={removeApiKey}
            onRunNow={triggerAutoRun}
            onStopRun={triggerStopAutoRun}
            runActionLoading={autoRunActionLoading}
          />
        )}
      </main>
    </div>
  );
}

export default App;
