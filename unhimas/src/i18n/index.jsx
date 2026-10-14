import { createContext, useContext, useState, useEffect } from 'react';
import { en } from './en';
import { fr } from './fr';

const translations = { en, fr };

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage === 'fr' ? 'fr' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      if (value === undefined) return key;
      value = value[k];
    }
    return value || key;
  };

  const translateText = (text) => {
    if (typeof text !== 'string' || language === 'en') return text;
    return fr.ui[text] || text;
  };

  const toggleLanguage = () => {
    setLanguage(lang => lang === 'en' ? 'fr' : 'en');
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, toggleLanguage, t, translateText }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
