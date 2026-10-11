/**
 * Reusable UTM tracking utility for external links and landing campaigns.
 * Conforms to privacy-preserving standards without collecting invasive personal data.
 */

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const UTM_STORAGE_KEY = 'unhimas_utm_context';

/**
 * Extracts any UTM parameters present in the current URL search string.
 * @returns {Record<string, string>}
 */
export function extractCurrentUtmParams() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  UTM_PARAMS.forEach((key) => {
    const val = params.get(key);
    if (val) utm[key] = val;
  });
  return utm;
}

/**
 * Persists the first-touch non-invasive UTM context to sessionStorage.
 */
export function captureLandingUtm() {
  if (typeof window === 'undefined') return;
  const current = extractCurrentUtmParams();
  if (Object.keys(current).length > 0) {
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Storage unavailable or disabled
    }
  }
}

/**
 * Retrieves the preserved session UTM context if available.
 * @returns {Record<string, string>}
 */
export function getSavedUtmContext() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Decorates an external URL with preserved UTM tracking parameters.
 * Does not overwrite existing params on the destination URL.
 * @param {string} url - Target URL
 * @param {Record<string, string>} [customParams] - Optional additional UTM params
 * @returns {string} Decorated URL
 */
export function decorateExternalLink(url, customParams = {}) {
  try {
    const parsed = new URL(url, window?.location?.origin || 'https://unhimas.cm');
    const preserved = { ...getSavedUtmContext(), ...customParams };

    Object.entries(preserved).forEach(([key, value]) => {
      if (value && !parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, value);
      }
    });

    return parsed.toString();
  } catch {
    return url;
  }
}
