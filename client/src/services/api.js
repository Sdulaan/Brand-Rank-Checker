const toQueryString = (params) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, value);
    }
  });
  return sp.toString();
};

const request = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export const getBrands = () => request(`/api/brands?${toQueryString({ active: true })}`);

export const checkTopTen = (payload) =>
  request('/api/serp/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getRankingHistory = (brandId, range) =>
  request(`/api/analytics/brands/${brandId}/ranking-history?${toQueryString({ range })}`);

export const getAdminSettings = () => request('/api/admin/settings');

export const getAdminDashboard = () => request('/api/admin/dashboard');

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
