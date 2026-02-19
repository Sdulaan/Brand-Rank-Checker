const axios = require('axios');
const { extractHostFromLink, getRootDomain, tokenizeValue, safeUrl } = require('../utils/domain');

const SERPER_URL = 'https://google.serper.dev/search';

const buildLookup = (domains) => {
  const mapExactHostKey = new Map(); // hostKey -> [domain]
  const mapRootKey = new Map();
  const tokenIndex = new Map(); // token -> Set(domainId)
  const mapById = new Map(); // id -> domain
  const hostKeys = new Set();

  const listDomainsSortedBySpecificityDesc = [...domains].sort((a, b) => {
    const hostDelta = b.domainHostKey.length - a.domainHostKey.length;
    if (hostDelta !== 0) return hostDelta;
    return (b.domainPathPrefix || '').length - (a.domainPathPrefix || '').length;
  });

  domains.forEach((item) => {
    hostKeys.add(item.domainHostKey);
    mapById.set(item._id.toString(), item);

    if (!mapExactHostKey.has(item.domainHostKey)) {
      mapExactHostKey.set(item.domainHostKey, []);
    }
    mapExactHostKey.get(item.domainHostKey).push(item);

    if (!mapRootKey.has(item.domainRootKey)) {
      mapRootKey.set(item.domainRootKey, []);
    }
    mapRootKey.get(item.domainRootKey).push(item);

    (item.tokens || []).forEach((token) => {
      if (!tokenIndex.has(token)) {
        tokenIndex.set(token, new Set());
      }
      tokenIndex.get(token).add(item._id.toString());
    });
  });

  return {
    mapExactHostKey,
    mapRootKey,
    listDomainsSortedBySpecificityDesc,
    tokenIndex,
    mapById,
    hostKeysSortedByLengthDesc: [...hostKeys].sort((a, b) => b.length - a.length),
  };
};

const resolveBestMatch = (candidates) => {
  if (!candidates.length) return null;
  return candidates.sort((a, b) => {
    const hostDelta = b.domainHostKey.length - a.domainHostKey.length;
    if (hostDelta !== 0) return hostDelta;
    return (b.domainPathPrefix || '').length - (a.domainPathPrefix || '').length;
  })[0];
};

const isUrlSafeBoundary = (ch) => {
  if (!ch) return true;
  return !/[a-z0-9.-]/i.test(ch);
};

const containsDomainInUrlString = (url, domainHostKey) => {
  if (!url || !domainHostKey) return false;
  const urlStr = String(url).toLowerCase();
  const needle = String(domainHostKey).toLowerCase();
  if (!needle) return false;

  const idx = urlStr.indexOf(needle);
  if (idx === -1) return false;

  const before = urlStr[idx - 1];
  const after = urlStr[idx + needle.length];
  return isUrlSafeBoundary(before) && isUrlSafeBoundary(after);
};

const getUrlPathname = (url) => {
  const parsed = safeUrl(url);
  if (!parsed) return '';
  return String(parsed.pathname || '/');
};

const matchesPathPrefix = (candidate, pathname) => {
  const prefix = candidate?.domainPathPrefix || '';
  if (!prefix) return true;
  if (!pathname) return false;
  if (pathname === prefix) return true;
  return pathname.startsWith(`${prefix}/`);
};

const selectBestByPath = (candidates, resultLink) => {
  if (!candidates.length) return null;
  const pathname = getUrlPathname(resultLink);
  const matched = candidates.filter((c) => matchesPathPrefix(c, pathname));
  return resolveBestMatch(matched.length ? matched : candidates);
};

const classifyResult = (resultHost, resultLink, lookup) => {
  if (!resultHost) {
    return { matchedDomain: null, matchType: 'none' };
  }

  const exactCandidates = lookup.mapExactHostKey.get(resultHost) || [];
  if (exactCandidates.length) {
    return { matchedDomain: selectBestByPath(exactCandidates, resultLink), matchType: 'exact' };
  }

  const suffixCandidates = [];
  lookup.hostKeysSortedByLengthDesc.forEach((hostKey) => {
    if (resultHost === hostKey || resultHost.endsWith(`.${hostKey}`)) {
      suffixCandidates.push(...(lookup.mapExactHostKey.get(hostKey) || []));
    }
  });

  const rootCandidates = lookup.mapRootKey.get(getRootDomain(resultHost)) || [];
  suffixCandidates.push(...rootCandidates);

  const suffix = selectBestByPath(
    suffixCandidates.filter((item, index, arr) => arr.findIndex((x) => x._id.toString() === item._id.toString()) === index),
    resultLink
  );

  if (suffix) {
    return { matchedDomain: suffix, matchType: 'suffix' };
  }

  if (resultLink) {
    // Some SERP results use redirect/tracking URLs where the real domain appears in query params.
    // If the full DB domain appears in the URL string, treat it as a match.
    let decodedLink = '';
    try {
      decodedLink = decodeURIComponent(resultLink);
    } catch (error) {
      decodedLink = '';
    }

    const bestContains = lookup.listDomainsSortedBySpecificityDesc.find((domainItem) => {
      const needle = domainItem.domain;
      return (
        containsDomainInUrlString(resultLink, needle) ||
        containsDomainInUrlString(resultLink, domainItem.domainHostKey) ||
        (decodedLink &&
          (containsDomainInUrlString(decodedLink, needle) || containsDomainInUrlString(decodedLink, domainItem.domainHostKey)))
      );
    });

    if (bestContains) {
      return { matchedDomain: bestContains, matchType: 'contains' };
    }
  }

  const hostTokens = new Set([...tokenizeValue(resultHost), ...tokenizeValue(resultLink)]);

  const tokenCandidates = [];
  hostTokens.forEach((token) => {
    if (token.length < 4) return;
    const hostSet = lookup.tokenIndex.get(token);
    if (!hostSet) return;

    hostSet.forEach((domainId) => {
      const candidate = lookup.mapById.get(domainId);
      if (candidate) {
        tokenCandidates.push(candidate);
      }
    });
  });

  const tokenMatch = selectBestByPath(
    tokenCandidates.filter((item, index, arr) => arr.findIndex((x) => x._id.toString() === item._id.toString()) === index),
    resultLink
  );

  if (tokenMatch) {
    return { matchedDomain: tokenMatch, matchType: 'token' };
  }

  return { matchedDomain: null, matchType: 'none' };
};

const fetchSerpResults = async ({ apiKey, query, gl = 'id', hl = 'id', num = 10, device = 'desktop' }) =>
  axios.post(
    SERPER_URL,
    {
      q: query,
      gl,
      hl,
      num,
      device,
    },
    {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );

module.exports = {
  fetchSerpResults,
  buildLookup,
  classifyResult,
};
