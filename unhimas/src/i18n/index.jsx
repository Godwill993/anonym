import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { en } from './en';
import { fr } from './fr';

const translations = { en, fr };

const I18nContext = createContext();

/** Flatten nested translation objects to value -> path map for reverse lookup. */
function buildReverseMap(obj, prefix = '', out = new Map()) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      // Prefer first (most specific) mapping; ui map is handled separately
      if (!out.has(v)) out.set(v, path);
    } else if (v && typeof v === 'object') {
      buildReverseMap(v, path, out);
    }
  }
  return out;
}

function getNested(obj, keyPath) {
  const keys = keyPath.split('.');
  let value = obj;
  for (const k of keys) {
    if (value === undefined || value === null) return undefined;
    value = value[k];
  }
  return value;
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const savedLanguage = localStorage.getItem('language');
      return savedLanguage === 'fr' ? 'fr' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const enReverse = useMemo(() => buildReverseMap(en), []);

  const t = useCallback(
    (key) => {
      if (typeof key !== 'string' || !key) return key;
      const primary = getNested(translations[language], key);
      if (typeof primary === 'string') return primary;
      // Fall back to English so missing FR keys never show raw paths
      if (language !== 'en') {
        const fallback = getNested(en, key);
        if (typeof fallback === 'string') return fallback;
      }
      return key;
    },
    [language],
  );

  /**
   * Translate free-form English UI strings used across the app.
   * Resolution order:
   *  1. Exact match in fr.ui
   *  2. Reverse lookup: English value found under en.* → same path under fr.*
   *  3. Original text (English)
   */
  const translateText = useCallback(
    (text) => {
      if (typeof text !== 'string') return text;
      const trimmed = text.trim();
      if (!trimmed) return text;
      if (language === 'en') return text;

      // 1. Explicit UI dictionary (preferred for page copy)
      if (fr.ui && Object.prototype.hasOwnProperty.call(fr.ui, trimmed)) {
        return fr.ui[trimmed];
      }
      if (fr.ui && Object.prototype.hasOwnProperty.call(fr.ui, text)) {
        return fr.ui[text];
      }

      // 2. Same string used as a nested en value → use parallel fr path
      const path = enReverse.get(trimmed) || enReverse.get(text);
      if (path) {
        const fromFr = getNested(fr, path);
        if (typeof fromFr === 'string') return fromFr;
      }

      return text;
    },
    [language, enReverse],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage((lang) => (lang === 'en' ? 'fr' : 'en'));
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t, translateText }),
    [language, toggleLanguage, t, translateText],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
