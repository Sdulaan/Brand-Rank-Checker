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
import AutoCheckLogPanel from './components/AutoCheckLogPanel';
import UserDashboard from './components/UserDashboard';
import {
  addAdminApiKey,
  checkTopTen,
  createDomain,
  createUser,
  deleteUser,
  deleteDomain,
  deleteAdminApiKey,
  getAdminDashboard,
  getAuthToken,
  getBrands,
  getDomainActivityLogs,
  getAutoCheckLogs,
  getDomains,
  getMe,
  getRankingHistory,
  getRecentAutoChecks,
  getUsers,
  login,
  setAuthToken,
  stopAutoRun,
  updateAdminApiKey,
  updateAdminSchedule,
  updateUser,
  updateMyPassword,
  updateMyProfile,
} from './services/api';

function App() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === 'localhost' ? 'http://localhost:4000' : 'http://168.231.122.240:4000');;
  const getWibClock = () => ({
    time: new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date()),
  });

  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState('dashboard');

  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [resultsByBrand, setResultsByBrand] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [adminDashboard, setAdminDashboard] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [autoRunActionLoading, setAutoRunActionLoading] = useState(false);
  const [wibClock, setWibClock] = useState(getWibClock());

  // Dashboard enriched brands state
  const [dashboardBrands, setDashboardBrands] = useState([]);
  const [totalDomains, setTotalDomains] = useState(0);

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
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'checker', label: 'Manual Checker' },
        { id: 'domains', label: 'Brands & Analytics' },
        { id: 'profile', label: 'My Profile' },
      ];
    }

    return [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'checker', label: 'Manual Checker' },
      { id: 'domains', label: 'Brands & Analytics' },
      { id: 'admin', label: 'Admin Config' },
      { id: 'domain-logs', label: 'Domain Logs' },
      { id: 'auto-check-logs', label: 'Auto Check Logs' },
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

  // Load enriched brand data for the dashboard
  useEffect(() => {
    if (!brands.length || tab !== 'dashboard') return;

    const loadDashboardBrands = async () => {
      try {
        const domainList = await getDomains();
        setTotalDomains(domainList.length);
        const enriched = await Promise.all(
          brands.map(async (brand) => {
            try {
              const [history, recentAutoChecksPayload] = await Promise.all([
                getRankingHistory(brand._id, '1d'),
                getRecentAutoChecks(brand._id, 5),
              ]);
              const points = (history.points || []).filter((p) => p.bestOwnRank !== null);
              const latest = points[points.length - 1];
              return {
                ...brand,
                currentRank: latest?.bestOwnRank ?? null,
                delta: history.delta ?? null,
                trend: history.trend ?? null,
                lastChecked: latest?.checkedAt ?? null,
                recentAutoChecks: recentAutoChecksPayload?.runs || [],
              };
            } catch {
              return {
                ...brand,
                currentRank: null,
                delta: null,
                trend: null,
                lastChecked: null,
                recentAutoChecks: [],
              };
            }
          })
        );
        setDashboardBrands(enriched);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      }
    };

    loadDashboardBrands();
  }, [brands, tab]);

  const selectedResult = useMemo(() => {
    if (!selectedBrand) return null;
    return resultsByBrand[selectedBrand._id] || null;
  }, [resultsByBrand, selectedBrand]);

  const handleLogin = async ({ email, password }) => {
    const data = await login({ email, password });
    setCurrentUser(data.user);
    setTab('dashboard');
  };

  const logout = () => {
    setAuthToken('');
    setCurrentUser(null);
    setBrands([]);
    setSelectedBrand(null);
    setResultsByBrand({});
    setDashboardBrands([]);
    setTab('dashboard');
  };

  const runCheck = async ({ brandId, query, country, isMobile }) => {
    setLoading(true);
    setError('');
    try {
      const response = await checkTopTen({ brandId, query, country, isMobile });
      setResultsByBrand((prev) => ({ ...prev, [brandId]: response }));
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

    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    const onDashboardUpdated = () => {
      refreshAdminDashboard({ showLoader: false });
    };

    socket.on('admin:dashboard-updated', onDashboardUpdated);

    return () => {
      socket.off('admin:dashboard-updated', onDashboardUpdated);
      socket.disconnect();
    };
  }, [tab, socketUrl, isAdmin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWibClock(getWibClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const triggerStartAutoRun = async () => {
    setAutoRunActionLoading(true);
    try {
      const intervalMinutes =
        Number(adminDashboard?.settings?.checkIntervalMinutes) ||
        Math.round((Number(adminDashboard?.settings?.checkIntervalHours) || 1) * 60);
      await updateAdminSchedule({
        autoCheckEnabled: true,
        checkIntervalMinutes: intervalMinutes,
      });
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to start auto check');
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

  const handleAdminUpdateUser = (userId, payload) => updateUser(userId, payload);
  const handleAdminDeleteUser = (userId) => deleteUser(userId);

  const loadDomains = () => getDomains();
  const addDomain = (payload) => createDomain(payload);
  const removeDomain = (domainId) => deleteDomain(domainId);

  if (!authReady) {
    return <div className="p-4 text-sm text-slate-600">Loading...</div>;
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <BrandSidebar
        brands={brands}
        selectedBrandId={selectedBrand?._id}
        onSelect={(brand) => {
          setSelectedBrand(brand);
          if (tab !== 'checker' && tab !== 'domains') {
            setTab('domains');
          }
        }}
      />

      <main className="flex-1">
        <header className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === item.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                  WIB
                </span>
                <div className="leading-tight">
                  <p className="font-mono text-sm font-bold text-slate-900">{wibClock.time}</p>
                </div>
              </div>
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

        {tab === 'dashboard' && (
          <UserDashboard
            username={currentUser.username}
            brands={dashboardBrands}
            totalDomains={totalDomains}
          />
        )}

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
            onStartAutoCheck={triggerStartAutoRun}
            onStopRun={triggerStopAutoRun}
            runActionLoading={autoRunActionLoading}
          />
        )}

        {isAdmin && tab === 'users' && (
          <UserManagementPanel
            onLoadUsers={getUsers}
            onCreateUser={createUser}
            onUpdateUser={handleAdminUpdateUser}
            onDeleteUser={handleAdminDeleteUser}
          />
        )}

        {isAdmin && tab === 'domain-logs' && (
          <DomainActivityLogPanel onLoadLogs={getDomainActivityLogs} />
        )}

        {isAdmin && tab === 'auto-check-logs' && (
          <AutoCheckLogPanel onLoadLogs={getAutoCheckLogs} />
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
