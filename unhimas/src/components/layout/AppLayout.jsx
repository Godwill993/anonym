import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import '../../styles/layout.css';
import '../../styles/ux.css';
import '../../styles/ui-polish.css';

export default function AppLayout({ children, pageTitle }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="app-shell">
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
          mobileNavOpen={mobileOpen}
        />

        <main id="main-content" className="page-content" tabIndex={-1}>
          <div key={location.pathname} className="page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
