import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import BrandSidebar from './components/BrandSidebar';
import CheckPanel from './components/CheckPanel';
import ResultsList from './components/ResultsList';
import AdminPanel from './components/AdminPanel';
import LoginPage from './components/LoginPage';
import ProfilePanel from './components/ProfilePanel';
import UserManagementPanel from './components/UserManagementPanel';
import DomainManagementPanel from './components/DomainManagementPanel';
import DomainActivityLogPanel from './components/DomainActivityLogPanel';
import {
  addAdminApiKey,
  checkTopTen,
  createDomain,
  bulkCreateDomains,
  createUser,
  deleteDomain,
  deleteAdminApiKey,
  getAdminDashboard,
  getAuthToken,
  getBrands,
  getDomainActivityLogs,
  getDomains,
  getMe,
  getRankingHistory,
  getUsers,
  login,
  runAutoNow,
  setAuthToken,
  stopAutoRun,
  updateAdminApiKey,
  updateAdminSchedule,
  updateMyPassword,
  updateMyProfile,
} from './services/api';

function App() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://url-rank-checker.onrender.com';

  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState('checker');

  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [resultsByBrand, setResultsByBrand] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [adminDashboard, setAdminDashboard] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [autoRunActionLoading, setAutoRunActionLoading] = useState(false);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        if (!getAuthToken()) {
          setAuthReady(true);
          return;
        }

        const me = await getMe();
        setCurrentUser(me);
      } catch (err) {
        setAuthToken('');
        setCurrentUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const tabs = useMemo(() => {
    if (!isAdmin) {
      return [
        { id: 'checker', label: 'Manual Checker' },
        { id: 'domains', label: 'Brands' },
        { id: 'profile', label: 'My Profile' },
      ];
    }

    return [
      { id: 'checker', label: 'Manual Checker' },
      { id: 'domains', label: 'Brands & Analytics' },
      { id: 'admin', label: 'Admin Config' },
      { id: 'domain-logs', label: 'Domain Logs' },
      { id: 'users', label: 'User Management' },
      { id: 'profile', label: 'My Profile' },
    ];
  }, [isAdmin]);

  useEffect(() => {
    if (!authReady || !currentUser) return;

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
  }, [authReady, currentUser]);

  const selectedResult = useMemo(() => {
    if (!selectedBrand) return null;
    return resultsByBrand[selectedBrand._id] || null;
  }, [resultsByBrand, selectedBrand]);

  const handleLogin = async ({ email, password }) => {
    const data = await login({ email, password });
    setCurrentUser(data.user);
    setTab('checker');
  };

  const logout = () => {
    setAuthToken('');
    setCurrentUser(null);
    setBrands([]);
    setSelectedBrand(null);
    setResultsByBrand({});
    setTab('checker');
  };

  const runCheck = async ({ brandId, query, country, isMobile }) => {
    setLoading(true);
    setError('');
    try {
      const response = await checkTopTen({ brandId, query, country, isMobile });
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

  const refreshAdminDashboard = async ({ showLoader = true } = {}) => {
    if (!isAdmin) return;
    if (showLoader) setAdminLoading(true);
    setAdminError('');
    try {
      const data = await getAdminDashboard();
      setAdminDashboard(data);
    } catch (err) {
      setAdminError(err.message || 'Failed to load admin dashboard');
    } finally {
      if (showLoader) setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'admin') {
      refreshAdminDashboard({ showLoader: true });
    }
  }, [tab, isAdmin]);

  useEffect(() => {
    if (!isAdmin || tab !== 'admin') return undefined;

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
  }, [tab, socketUrl, isAdmin]);

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

  const handleUpdateProfile = async (payload) => {
    const me = await updateMyProfile(payload);
    setCurrentUser(me);
  };

  const loadDomains = () => getDomains();
  const addDomain = (payload) => createDomain(payload);
  const bulkAddDomains = (payload) => bulkCreateDomains(payload);
  const removeDomain = (domainId) => deleteDomain(domainId);

  if (!authReady) {
    return <div className="p-4 text-sm text-slate-600">Loading...</div>;
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <BrandSidebar brands={brands} selectedBrandId={selectedBrand?._id} onSelect={setSelectedBrand} />

      <main className="flex-1">
        <header className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => (
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">
                {currentUser.username} ({currentUser.role})
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold"
              >
                Logout
              </button>
            </div>
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

        {tab === 'domains' && (
          <DomainManagementPanel
            brands={brands}
            selectedBrand={selectedBrand}
            isAdmin={isAdmin}
            onLoadDomains={loadDomains}
            onCreateDomain={addDomain}
            onBulkCreateDomains={bulkAddDomains}
            onDeleteDomain={removeDomain}
            onGetRankingHistory={getRankingHistory}
          />
        )}

        {isAdmin && tab === 'admin' && (
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

        {isAdmin && tab === 'users' && (
          <UserManagementPanel onLoadUsers={getUsers} onCreateUser={createUser} />
        )}

        {isAdmin && tab === 'domain-logs' && (
          <DomainActivityLogPanel onLoadLogs={getDomainActivityLogs} />
        )}

        {tab === 'profile' && (
          <ProfilePanel
            user={currentUser}
            onUpdateProfile={handleUpdateProfile}
            onUpdatePassword={updateMyPassword}
          />
        )}
      </main>
    </div>
  );
}

export default App;