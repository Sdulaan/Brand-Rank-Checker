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
