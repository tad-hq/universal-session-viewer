function sanitizeFTS5Query(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }

  let sanitized = query
    .replace(/NEAR\s*\(/gi, '')
    .replace(/OR\s+\*/g, '')
    .replace(/\*/g, '')
    .replace(/[()]/g, '')
    .replace(/:/g, '')
    .replace(/"/g, '')
    .replace(/AND/gi, ' ')
    .replace(/OR/gi, ' ')
    .replace(/NOT/gi, ' ')
    .trim();

  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  return sanitized || 'invalid_query_that_matches_nothing';
}

function isCacheStillValid(analysisTimestamp, cacheDurationDays = 30) {
  if (!analysisTimestamp || analysisTimestamp <= 0) {
    return false;
  }

  if (cacheDurationDays <= 0) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cacheAgeSeconds = nowSeconds - analysisTimestamp;
  const maxAgeSeconds = cacheDurationDays * 24 * 60 * 60;

  const isValid = cacheAgeSeconds <= maxAgeSeconds;

  return isValid;
}

module.exports = { sanitizeFTS5Query, isCacheStillValid };
