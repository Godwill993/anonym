import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MdArrowUpward } from 'react-icons/md';
import Sidebar from './Sidebar';
import Header from './Header';
import { useTranslation } from '../../i18n';
import '../../styles/layout.css';
import '../../styles/ux.css';

export default function AppLayout({ children, pageTitle }) {
  const { translateText } = useTranslation();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Smooth scroll to top + reset progress whenever the route changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setScrollProgress(0);
    setShowBackToTop(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const el = document.documentElement;
      const scrolled = window.scrollY || el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setScrollProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0);
      setShowBackToTop(scrolled > 320);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="app-shell">
      <div
        className="scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={translateText('Page scroll progress')}
      />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={`main-area ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          onMenuClick={() => setMobileOpen((v) => !v)}
          pageTitle={pageTitle}
        />

        {/*
          Key by pathname so the enter animation re-runs on every navigation.
          Sidebar + header stay mounted and do not flash.
        */}
        <main id="main-content" className="page-content" tabIndex={-1}>
          <div key={location.pathname} className="page-transition">
            {children}
          </div>
        </main>
      </div>

      <button
        type="button"
        className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label={translateText('Back to top')}
        title={translateText('Back to top')}
      >
        <MdArrowUpward />
      </button>
    </div>
  );
}
