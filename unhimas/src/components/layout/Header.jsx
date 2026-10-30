import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  MdMenu,
  MdSearch,
  MdNotifications,
  MdAccountCircle,
  MdSettings,
  MdLogout,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/index';
import { supabase } from '../../lib/supabase';
import GlobalSearchModal from './GlobalSearchModal';

const ROLE_LABELS = {
  admin: 'Administrator',
  lecturer: 'Lecturer',
  student: 'Student',
};

const ROLE_PROFILE_PATHS = {
  admin: '/admin/profile',
  lecturer: '/lecturer/profile',
  student: '/student/profile',
};

export default function Header({ onMenuClick, pageTitle, mobileNavOpen = false }) {
  const { profile, signOut } = useAuth();
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
  const menuBtnRef = useRef(null);
  const navigate = useNavigate();

  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false);
    menuBtnRef.current?.focus();
  }, []);

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

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard support for user menu
  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const menu = userMenuRef.current?.querySelector('[role="menu"]');
    const items = () =>
      Array.from(menu?.querySelectorAll('[role="menuitem"]') || []).filter(
        (el) => el instanceof HTMLElement && !el.hasAttribute('disabled'),
      );

    // Focus first item when menu opens
    const t = window.setTimeout(() => {
      const first = items()[0];
      first?.focus();
    }, 0);

    const onKey = (e) => {
      const list = items();
      if (!list.length) return;
      const idx = list.indexOf(document.activeElement);

      if (e.key === 'Escape') {
        e.preventDefault();
        closeUserMenu();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = idx < 0 ? list[0] : list[(idx + 1) % list.length];
        next?.focus();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = idx < 0 ? list[list.length - 1] : list[(idx - 1 + list.length) % list.length];
        prev?.focus();
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        list[0]?.focus();
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        list[list.length - 1]?.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen, closeUserMenu]);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
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
        <a href="#main-content" className="skip-link">
          {translateText('Skip to main content')}
        </a>

        <button
          type="button"
          className="header-mobile-menu-btn"
          onClick={onMenuClick}
          aria-label={
            mobileNavOpen
              ? translateText('Close navigation menu')
              : translateText('Open navigation menu')
          }
          aria-expanded={mobileNavOpen}
          aria-controls="app-sidebar"
        >
          <MdMenu aria-hidden="true" />
        </button>

        <div className="header-breadcrumb">
          <span className="breadcrumb-title">{translateText(pageTitle || 'Dashboard')}</span>
        </div>

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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSearchOpen(true);
              }
            }}
          />
        </div>

        <div className="header-actions">
          <Link
            className={`icon-btn${unreadNotificationCount > 0 ? ' has-unread-notifications' : ''}`}
            to={
              role === 'admin'
                ? '/admin/notifications'
                : role === 'lecturer'
                  ? '/lecturer/notifications'
                  : '/student/notifications'
            }
            aria-label={`${translateText('Notifications')}${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} ${translateText('unread')})` : unreadNotificationsError ? ` (${translateText('count unavailable')})` : ''}`}
            title={
              unreadNotificationsError
                ? translateText('Notification count unavailable')
                : translateText('Notifications')
            }
          >
            <MdNotifications aria-hidden="true" />
            {unreadNotificationCount > 0 && (
              <span className="notif-badge" aria-hidden="true">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="lang-btn"
            onClick={toggleLanguage}
            aria-label={`Switch to ${language === 'en' ? 'French' : 'English'}`}
            title={
              language === 'en'
                ? translateText('Passer en Français')
                : translateText('Switch to English')
            }
          >
            {language === 'en' ? 'FR' : 'EN'}
          </button>

          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              ref={menuBtnRef}
              type="button"
              className="user-menu-btn"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-controls="user-menu"
              aria-label={translateText('User menu')}
            >
              <div className="user-avatar" aria-hidden="true">
                {initials}
              </div>
              <span className="user-name">{profile?.full_name || 'User'}</span>
            </button>

            {userMenuOpen && (
              <div
                id="user-menu"
                className="dropdown-menu"
                role="menu"
                aria-label={translateText('User options')}
              >
                <div
                  style={{
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8375rem',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                    }}
                  >
                    {profile?.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginTop: '0.1rem',
                    }}
                  >
                    {translateText(ROLE_LABELS[role])}
                  </div>
                </div>
                <Link
                  to={profilePath}
                  className="dropdown-item"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => setUserMenuOpen(false)}
                >
                  <MdAccountCircle aria-hidden="true" /> {translateText('Profile')}
                </Link>
                {role === 'admin' && (
                  <Link
                    to="/admin/settings"
                    className="dropdown-item"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <MdSettings aria-hidden="true" /> {translateText('Settings')}
                  </Link>
                )}
                <div className="dropdown-divider" role="separator" />
                <button
                  type="button"
                  className="dropdown-item danger"
                  role="menuitem"
                  tabIndex={-1}
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
