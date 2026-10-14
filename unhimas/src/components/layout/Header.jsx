import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  MdMenu,
  MdSearch,
  MdNotifications,
  MdDarkMode,
  MdLightMode,
  MdAccountCircle,
  MdSettings,
  MdLogout,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../i18n/index';
import { supabase } from '../../lib/supabase';
import GlobalSearchModal from './GlobalSearchModal';

const ROLE_LABELS = {
  admin: 'Administrator',
  frontdesk: 'Front Desk',
  lecturer: 'Lecturer',
  student: 'Student',
};

const ROLE_PROFILE_PATHS = {
  admin: '/admin/profile',
  frontdesk: '/frontdesk/profile',
  lecturer: '/lecturer/profile',
  student: '/student/profile',
};

export default function Header({ onMenuClick, pageTitle }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, translateText } = useTranslation();
  const { data: unreadNotificationCount = 0, isError: unreadNotificationsError } = useQuery({
    queryKey: ['unread-notification-count', profile?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!profile?.id,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const role = profile?.role || 'student';
  const profilePath = ROLE_PROFILE_PATHS[role] || '/';

  return (
    <>
      <header className="app-header" role="banner">
        {/* Skip to main content */}
        <a href="#main-content" className="skip-link">{translateText('Skip to main content')}</a>

        {/* Mobile menu toggle */}
        <button
          className="header-mobile-menu-btn"
          onClick={onMenuClick}
          aria-label={translateText('Open navigation menu')}
        >
          <MdMenu />
        </button>

        {/* Breadcrumb / page title */}
        <div className="header-breadcrumb" aria-label={translateText('Breadcrumb')}>
          <span className="breadcrumb-title">{translateText(pageTitle || 'Dashboard')}</span>
        </div>

        {/* Search */}
        <div
          className="header-search"
          role="search"
          onClick={() => setSearchOpen(true)}
          style={{ cursor: 'pointer' }}
          title={translateText('Search anything (Ctrl+K)')}
        >
          <MdSearch className="header-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="header-search-input"
            placeholder={translateText('Search... (Ctrl+K)')}
            aria-label={translateText('Search')}
            readOnly
            onClick={() => setSearchOpen(true)}
          />
        </div>

      {/* Action buttons */}
      <div className="header-actions">
        {/* Notifications */}
        <Link
          className={`icon-btn${unreadNotificationCount > 0 ? ' has-unread-notifications' : ''}`}
          to={role === 'admin' ? '/admin/notifications' : role === 'frontdesk' ? '/frontdesk' : role === 'lecturer' ? '/lecturer/notifications' : '/student/notifications'}
          aria-label={`${translateText('Notifications')}${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} ${translateText('unread')})` : unreadNotificationsError ? ` (${translateText('count unavailable')})` : ''}`}
          title={unreadNotificationsError ? translateText('Notification count unavailable') : translateText('Notifications')}
        >
          <MdNotifications />
          {unreadNotificationCount > 0 && (
            <span className="notif-badge" aria-hidden="true">
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </Link>

        {/* Dark mode toggle */}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={translateText(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
          title={translateText(theme === 'dark' ? 'Light mode' : 'Dark mode')}
        >
          {theme === 'dark' ? <MdLightMode /> : <MdDarkMode />}
        </button>

        {/* Language toggle */}
        <button
          className="lang-btn"
          onClick={toggleLanguage}
          aria-label={`Switch to ${language === 'en' ? 'French' : 'English'}`}
          title={language === 'en' ? translateText('Passer en Français') : translateText('Switch to English')}
        >
          {language === 'en' ? 'FR' : 'EN'}
        </button>

        {/* User menu */}
        <div className="user-menu-wrapper" ref={userMenuRef}>
          <button
            className="user-menu-btn"
            onClick={() => setUserMenuOpen(v => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label={translateText('User menu')}
          >
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <span className="user-name">{profile?.full_name || 'User'}</span>
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu" role="menu" aria-label="User options">
              <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.8375rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  {profile?.full_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                  {translateText(ROLE_LABELS[role])}
                </div>
              </div>
              <Link
                to={profilePath}
                className="dropdown-item"
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                <MdAccountCircle aria-hidden="true" /> {translateText('Profile')}
              </Link>
              {role === 'admin' && (
                <Link
                  to="/admin/settings"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <MdSettings aria-hidden="true" /> {translateText('Settings')}
                </Link>
              )}
              <div className="dropdown-divider" />
              <button
                className="dropdown-item danger"
                role="menuitem"
                onClick={handleSignOut}
              >
                <MdLogout aria-hidden="true" /> {translateText('Sign out')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </>
);
}
