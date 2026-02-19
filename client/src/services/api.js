const toQueryString = (params) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, value);
    }
  });
  return sp.toString();
};

let authToken = localStorage.getItem('auth_token') || '';

export const setAuthToken = (token) => {
  authToken = token || '';
  if (authToken) {
    localStorage.setItem('auth_token', authToken);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => authToken;

const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? ''
    : 'https://url-rank-checker.onrender.com';

const request = async (path, options = {}) => {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }

  return data;
};

export const login = async (payload) => {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(data.token);
  return data;
};

export const getMe = () => request('/api/auth/me');

export const updateMyProfile = (payload) =>
  request('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const updateMyPassword = (payload) =>
  request('/api/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const getUsers = () => request('/api/users');

export const createUser = (payload) =>
  request('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getBrands = () => request(`/api/brands?${toQueryString({ active: true })}`);

export const getDomains = (params = {}) => request(`/api/domains?${toQueryString(params)}`);

export const createDomain = (payload) =>
  request('/api/domains', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const bulkCreateDomains = (payload) =>
  request('/api/domains/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteDomain = (domainId) =>
  request(`/api/domains/${domainId}`, {
    method: 'DELETE',
  });

export const checkTopTen = (payload) =>
  request('/api/serp/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getRankingHistory = (brandId, range) =>
  request(`/api/analytics/brands/${brandId}/ranking-history?${toQueryString({ range })}`);

export const getAdminSettings = () => request('/api/admin/settings');

export const getAdminDashboard = () => request('/api/admin/dashboard');
export const getDomainActivityLogs = (limit = 100) =>
  request(`/api/admin/domain-logs?${toQueryString({ limit })}`);

export const updateAdminSchedule = (payload) =>
  request('/api/admin/settings/schedule', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const addAdminApiKey = (payload) =>
  request('/api/admin/settings/keys', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateAdminApiKey = (keyId, payload) =>
  request(`/api/admin/settings/keys/${keyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteAdminApiKey = (keyId) =>
  request(`/api/admin/settings/keys/${keyId}`, {
    method: 'DELETE',
  });

export const runAutoNow = () =>
  request('/api/admin/run-now', {
    method: 'POST',
  });

export const stopAutoRun = () =>
  request('/api/admin/stop-run', {
    method: 'POST',
  });
