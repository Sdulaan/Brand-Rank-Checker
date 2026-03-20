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
import BulkDomainCheckerPanel from './components/BulkDomainCheckerPanel';
import Flag from 'react-world-flags';
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
  updateAdminBackupSettings,
  updateAdminNotificationSettings,
  updateAdminSchedule,
  updateUser,
  updateMyPassword,
  updateMyProfile,
  runBackupNow,
  testAdminBackupTelegram,
  testAdminNotificationTelegram,
} from './services/api';

function App() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
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
  const [adminConfigView, setAdminConfigView] = useState('all');
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [resultsByBrand, setResultsByBrand] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [adminDashboard, setAdminDashboard] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const [autoRunActionLoading, setAutoRunActionLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [backupTestLoading, setBackupTestLoading] = useState(false);
  const [notificationTestLoading, setNotificationTestLoading] = useState(false);
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
  const isManager = currentUser?.role === 'manager';
  const canAccessAdminConfig = isAdmin || isManager;
  const canManageUsers = isAdmin;
  const adminConfigMenuItems = useMemo(() => {
    const items = [{ id: 'rank-check', label: 'Rank Check Config' }];
    if (isAdmin) {
      items.push(
        { id: 'backup', label: 'Backup Config' },
        { id: 'notifications', label: 'Notifications Config' }
      );
    }
    return items;
  }, [isAdmin]);

  const tabs = useMemo(() => {
    if (!canAccessAdminConfig) {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'checker', label: 'Manual Checker' },
        { id: 'bulk-checker', label: 'Bulk Domain Checker' },
        { id: 'domains', label: 'Brands & Analytics' },
        { id: 'profile', label: 'My Profile' },
      ];
    }

    const adminTabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'checker', label: 'Manual Checker' },
      { id: 'bulk-checker', label: 'Bulk Domain Checker' },
      { id: 'domains', label: 'Brands & Analytics' },
      { id: 'admin', label: 'Admin Config' },
      { id: 'domain-logs', label: 'Domain Logs' },
      { id: 'auto-check-logs', label: 'Auto Check Logs' },
      { id: 'profile', label: 'My Profile' },
    ];
    if (canManageUsers) {
      adminTabs.splice(6, 0, { id: 'users', label: 'User Management' });
    }
    return adminTabs;
  }, [canAccessAdminConfig, canManageUsers]);

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
    setAdminConfigView('all');
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
    if (!canAccessAdminConfig) return;
    if (showLoader) setAdminLoading(true);
    setAdminError('');
    setAdminNotice('');
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
    if (!canAccessAdminConfig) return;
    if (tab === 'admin') {
      refreshAdminDashboard({ showLoader: true });
    }
  }, [tab, canAccessAdminConfig]);

  useEffect(() => {
    if (!canAccessAdminConfig || tab !== 'admin' || !socketUrl) return undefined;

    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    const onDashboardUpdated = () => {
      refreshAdminDashboard({ showLoader: false });
    };

    socket.on('admin:dashboard-updated', onDashboardUpdated);

    return () => {
      socket.off('admin:dashboard-updated', onDashboardUpdated);
      socket.disconnect();
    };
  }, [tab, socketUrl, canAccessAdminConfig]);

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

  const saveBackupSettings = async (payload) => {
    try {
      setAdminNotice('');
      await updateAdminBackupSettings(payload);
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to update backup settings');
    }
  };

  const saveNotificationSettings = async (payload) => {
    try {
      setAdminNotice('');
      await updateAdminNotificationSettings(payload);
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to update notification settings');
    }
  };

  const triggerBackupNow = async () => {
    setBackupActionLoading(true);
    try {
      setAdminNotice('');
      await runBackupNow();
      await refreshAdminDashboard();
    } catch (err) {
      setAdminError(err.message || 'Failed to start backup');
    } finally {
      setBackupActionLoading(false);
    }
  };

  const triggerTestBackupTelegram = async (backupTelegramChatIds) => {
    setBackupTestLoading(true);
    try {
      setAdminError('');
      const result = await testAdminBackupTelegram({ backupTelegramChatIds });
      setAdminNotice(
        `Telegram test: ${result.okCount}/${result.total} successful${result.failCount ? `, ${result.failCount} failed` : ''}.`
      );
      await refreshAdminDashboard({ showLoader: false });
    } catch (err) {
      setAdminError(err.message || 'Failed to test Telegram bot/chat IDs');
    } finally {
      setBackupTestLoading(false);
    }
  };

  const triggerTestNotificationTelegram = async ({ notificationTelegramChatIds, notificationTelegramBotToken }) => {
    setNotificationTestLoading(true);
    try {
      setAdminError('');
      const payload = {
        notificationTelegramChatIds,
      };
      if (String(notificationTelegramBotToken || '').trim()) {
        payload.notificationTelegramBotToken = String(notificationTelegramBotToken).trim();
      }
      const result = await testAdminNotificationTelegram(payload);
      setAdminNotice(
        `Notification test: ${result.okCount}/${result.total} successful${result.failCount ? `, ${result.failCount} failed` : ''}.`
      );
      await refreshAdminDashboard({ showLoader: false });
    } catch (err) {
      setAdminError(err.message || 'Failed to test notification Telegram settings');
    } finally {
      setNotificationTestLoading(false);
    }
  };

  const handleAdminUpdateUser = (userId, payload) => updateUser(userId, payload);
  const handleAdminDeleteUser = (userId) => deleteUser(userId);
  const userInitial = (currentUser?.username || 'U').trim().charAt(0).toUpperCase();
  const mobilePrimaryTabIds = ['dashboard', 'bulk-checker', 'domains'];
  const mobilePrimaryTabs = mobilePrimaryTabIds
    .map((id) => tabs.find((item) => item.id === id))
    .filter(Boolean);
  const mobileExtraTabs = tabs.filter(
    (item) => item.id !== 'profile' && !mobilePrimaryTabIds.includes(item.id)
  );

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
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur lg:px-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <div className="order-1 flex items-center gap-2 rounded-xl border border-rose-100 bg-gradient-to-r from-white to-rose-50 px-3 py-1.5 shadow-sm lg:order-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full ">
                <Flag code="ID" height="20" />
              </span>
              <p className="font-mono text-base font-bold text-rose-600 sm:text-lg">{wibClock.time}</p>
            </div>
            <div className="order-2 flex items-center gap-2 lg:order-1">
              <button
                type="button"
                onClick={() => setTab('profile')}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition ${
                  tab === 'profile'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                title="My Profile"
                aria-label="Open my profile"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                  {userInitial}
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className={`text-xs font-semibold ${tab === 'profile' ? 'text-white' : 'text-slate-700'}`}>{currentUser.username}</p>
                  <p className={`text-[10px] uppercase tracking-wide ${tab === 'profile' ? 'text-slate-200' : 'text-slate-500'}`}>{currentUser.role}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid gap-2 lg:hidden">
            <div className="grid grid-cols-3 gap-2">
              {mobilePrimaryTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    if (item.id === 'admin') {
                      setAdminConfigView('all');
                    }
                  }}
                  className={`rounded-lg px-2 py-2 text-[11px] font-semibold leading-none transition ${
                    tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="block truncate">{item.label}</span>
                </button>
              ))}
            </div>
            {mobileExtraTabs.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {mobileExtraTabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      if (item.id === 'admin') {
                        setAdminConfigView('all');
                      }
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden items-center justify-between gap-4 lg:flex">
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => {
                if (item.id !== 'admin') {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => setAdminMenuOpen(true)}
                    onMouseLeave={() => setAdminMenuOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMenuOpen((prev) => !prev);
                      }}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                    <div
                      className={`absolute left-0 top-full z-20 mt-1 min-w-[190px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg transition ${
                        adminMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'
                      }`}
                    >
                      {adminConfigMenuItems.map((menuItem) => (
                        <button
                          key={menuItem.id}
                          type="button"
                          onClick={() => {
                            setTab('admin');
                            setAdminConfigView(menuItem.id);
                            setAdminMenuOpen(false);
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {menuItem.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-gradient-to-r from-white to-rose-50 px-3 py-1.5 shadow-sm">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full ">
                  <Flag code="ID" height="20" />
                </span>
                <p className="font-mono text-base font-bold text-rose-600 xl:text-lg">{wibClock.time}</p>
              </div>
              <button
                type="button"
                onClick={() => setTab('profile')}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition ${
                  tab === 'profile'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                title="My Profile"
                aria-label="Open my profile"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                  {userInitial}
                </span>
                <div className="leading-tight">
                  <p className={`text-xs font-semibold ${tab === 'profile' ? 'text-white' : 'text-slate-700'}`}>{currentUser.username}</p>
                  <p className={`text-[10px] uppercase tracking-wide ${tab === 'profile' ? 'text-slate-200' : 'text-slate-500'}`}>{currentUser.role}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        {tab !== 'bulk-checker' && (
          <BrandSidebar
            brands={brands}
            selectedBrandId={selectedBrand?._id}
            onSelect={(brand) => {
              setSelectedBrand(brand);
              if (tab !== 'dashboard' && tab !== 'checker' && tab !== 'domains') {
                setTab('domains');
              }
            }}
          />
        )}

        <main className="flex-1">
        {tab === 'dashboard' && (
          <UserDashboard
            username={currentUser.username}
            brands={dashboardBrands}
            totalDomains={totalDomains}
            focusedBrandId={selectedBrand?._id || ''}
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

        {tab === 'bulk-checker' && <BulkDomainCheckerPanel />}

        {tab === 'domains' && (
          <DomainManagementPanel
            brands={brands}
            selectedBrand={selectedBrand}
            canAddDomains={isAdmin || isManager}
            canDeleteDomains={isAdmin}
            onLoadDomains={loadDomains}
            onCreateDomain={addDomain}
            onDeleteDomain={removeDomain}
            onGetRankingHistory={getRankingHistory}
          />
        )}

        {canAccessAdminConfig && tab === 'admin' && (
          <AdminPanel
            dashboard={adminDashboard}
            loading={adminLoading}
            error={adminError}
            notice={adminNotice}
            onSaveSchedule={saveSchedule}
            onAddKey={addApiKey}
            onUpdateKey={updateApiKey}
            onDeleteKey={removeApiKey}
            onStartAutoCheck={triggerStartAutoRun}
            onStopRun={triggerStopAutoRun}
            runActionLoading={autoRunActionLoading}
            onSaveBackupSettings={saveBackupSettings}
            onSaveNotificationSettings={saveNotificationSettings}
            onRunBackupNow={triggerBackupNow}
            backupActionLoading={backupActionLoading}
            onTestBackupTelegram={triggerTestBackupTelegram}
            backupTestLoading={backupTestLoading}
            onTestNotificationTelegram={triggerTestNotificationTelegram}
            notificationTestLoading={notificationTestLoading}
            sectionView={adminConfigView}
            isManager={isManager}
          />
        )}

        {canManageUsers && tab === 'users' && (
          <UserManagementPanel
            onLoadUsers={getUsers}
            onCreateUser={createUser}
            onUpdateUser={handleAdminUpdateUser}
            onDeleteUser={handleAdminDeleteUser}
          />
        )}

        {canAccessAdminConfig && tab === 'domain-logs' && (
          <DomainActivityLogPanel onLoadLogs={getDomainActivityLogs} />
        )}

        {canAccessAdminConfig && tab === 'auto-check-logs' && (
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
    </div>
  );
}

export default App;
