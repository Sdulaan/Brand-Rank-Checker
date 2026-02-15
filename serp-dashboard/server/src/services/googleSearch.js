const axios = require('axios');

const GOOGLE_SEARCH_BASE_URL = 'https://customsearch.googleapis.com/customsearch/v1';

async function fetchTopTenGoogleResults({ apiKey, cx, query, gl = 'id', hl = 'id' }) {
  try {
    const response = await axios.get(GOOGLE_SEARCH_BASE_URL, {
      params: {
        key: apiKey,
        cx,
        q: query,
        num: 10,
        gl,
        hl
      },
      timeout: 15000
    });

    return {
      params: response.config.params,
      items: response.data.items || []
    };
  } catch (error) {
    if (error.response) {
      const reason = error.response.data?.error?.message || 'Google API request failed';
      const status = error.response.status;
      const mappedError = new Error(`Google API error (${status}): ${reason}`);
      mappedError.statusCode = status === 429 ? 429 : 502;
      mappedError.details = error.response.data;
      throw mappedError;
    }

    if (error.request) {
      const networkError = new Error('Failed to reach Google API. Please check network connectivity.');
      networkError.statusCode = 503;
      throw networkError;
    }

    const unknownError = new Error(`Unexpected Google API error: ${error.message}`);
    unknownError.statusCode = 500;
    throw unknownError;
  }
}

module.exports = { fetchTopTenGoogleResults, GOOGLE_SEARCH_BASE_URL };
