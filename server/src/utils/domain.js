const psl = require('psl');

const safeUrl = (input) => {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();
  if (!str) return null;

  try {
    if (str.includes('://')) {
      return new URL(str);
    }
    return new URL(`https://${str}`);
  } catch (error) {
    return null;
  }
};

const normalizeHost = (value) => {
  const parsed = safeUrl(value);
  if (!parsed) return '';

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) {
    host = host.slice(4);
  }
  return host;
};

const getRootDomain = (host) => {
  if (!host) return '';
  const parsed = psl.parse(host);
  if (parsed && parsed.domain) {
    return parsed.domain.toLowerCase();
  }
  return host;
};

const tokenizeValue = (value) => {
  if (!value) return [];
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, ' ')
    .split(/[.\-\s_]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
};

const buildDomainKeys = ({ domain, brandCode }) => {
  const domainHostKey = normalizeHost(domain);
  const domainRootKey = getRootDomain(domainHostKey);

  const rawTokens = new Set([
    ...tokenizeValue(domain),
    ...tokenizeValue(domainHostKey),
    ...tokenizeValue(domainRootKey),
    ...tokenizeValue(brandCode),
  ]);

  return {
    domainHostKey,
    domainRootKey,
    tokens: [...rawTokens],
  };
};

const extractHostFromLink = (link) => normalizeHost(link);

module.exports = {
  normalizeHost,
  getRootDomain,
  tokenizeValue,
  buildDomainKeys,
  extractHostFromLink,
};
