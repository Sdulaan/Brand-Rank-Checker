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

const normalizePathPrefix = (value) => {
  const parsed = safeUrl(value);
  if (!parsed) return '';

  const pathname = String(parsed.pathname || '/');
  if (!pathname || pathname === '/') return '';

  let cleaned = pathname.trim();
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned === '/' ? '' : cleaned;
};

const normalizeDomainForStorage = (value) => {
  const host = normalizeHost(value);
  if (!host) {
    return {
      domainNormalized: '',
      domainHostKey: '',
      domainPathPrefix: '',
    };
  }

  const pathPrefix = normalizePathPrefix(value);
  const domainNormalized = `${host}${pathPrefix || ''}`;

  return {
    domainNormalized,
    domainHostKey: host,
    domainPathPrefix: pathPrefix || '',
  };
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
  const normalized = normalizeDomainForStorage(domain);
  const domainHostKey = normalized.domainHostKey;
  const domainRootKey = getRootDomain(domainHostKey);
  const domainPathPrefix = normalized.domainPathPrefix;
  const domainNormalized = normalized.domainNormalized;

  const rawTokens = new Set([
    ...tokenizeValue(domain),
    ...tokenizeValue(domainPathPrefix),
    ...tokenizeValue(domainHostKey),
    ...tokenizeValue(domainRootKey),
    ...tokenizeValue(brandCode),
  ]);

  return {
    domainNormalized,
    domainHostKey,
    domainRootKey,
    domainPathPrefix,
    tokens: [...rawTokens],
  };
};

const extractHostFromLink = (link) => normalizeHost(link);
const extractPathFromLink = (link) => normalizePathPrefix(link);

module.exports = {
  normalizeHost,
  normalizePathPrefix,
  normalizeDomainForStorage,
  getRootDomain,
  tokenizeValue,
  buildDomainKeys,
  extractHostFromLink,
  extractPathFromLink,
};
