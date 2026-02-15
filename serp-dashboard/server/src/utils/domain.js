const psl = require('psl');

function extractHostname(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  try {
    const normalized = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
    const url = new URL(normalized);
    return url.hostname.toLowerCase();
  } catch (_error) {
    return null;
  }
}

function normalizeDomain(input) {
  const hostname = extractHostname(input);

  if (!hostname) {
    return null;
  }

  const stripped = hostname.replace(/^www\./, '');
  const parsed = psl.parse(stripped);

  if (parsed.error) {
    return stripped;
  }

  if (parsed.domain) {
    return parsed.domain.toLowerCase();
  }

  return stripped;
}

module.exports = {
  extractHostname,
  normalizeDomain
};
