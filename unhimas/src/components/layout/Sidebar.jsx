import { useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { NAV_CONFIG } from '../../constants/navConfig';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import logo from '../../assets/unhimas_logo.jpg';

const ROLE_PROFILE_PATHS = {
  admin: '/admin/profile',
  frontdesk: '/frontdesk/profile',
  lecturer: '/lecturer/profile',
  student: '/student/profile',
};

const ROLE_LABELS = {
  admin: 'Administrator',
  frontdesk: 'Front Desk',
  lecturer: 'Lecturer',
  student: 'Student',
};

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { profile } = useAuth();
  const { translateText } = useTranslation();
  const role = profile?.role || 'student';
  const navGroups = NAV_CONFIG[role] || [];
  const location = useLocation();

  // Accessibility: Close on Escape & lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onMobileClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen, onMobileClose]);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : (profile?.email ? profile.email[0].toUpperCase() : '?');

  const profilePath = ROLE_PROFILE_PATHS[role] || '/';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label={translateText('Main navigation')}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <img src={logo} alt="UNHIMAS logo" />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">UNHIMAS</span>
            <span className="sidebar-logo-tagline">{translateText('School Management')}</span>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="sidebar-nav" role="navigation">
          {navGroups.map((group) => (
            <div className="sidebar-group" key={group.group}>
              <div className="sidebar-group-label">{translateText(group.group)}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/admin' && item.path !== '/lecturer' &&
                   item.path !== '/student' && item.path !== '/frontdesk' &&
                   location.pathname.startsWith(item.path));
                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? translateText(item.label) : undefined}
                    onClick={onMobileClose}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span className="sidebar-item-label">{translateText(item.label)}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User profile footer */}
        <Link
          to={profilePath}
          className="sidebar-user-footer"
          onClick={onMobileClose}
          title={collapsed ? profile?.full_name || translateText('Profile') : undefined}
          aria-label={translateText('My Profile')}
        >
          <div className="sidebar-user-avatar" aria-hidden="true">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{profile?.full_name || 'User'}</span>
            <span className="sidebar-user-role">{translateText(ROLE_LABELS[role] || role)}</span>
          </div>
        </Link>

        {/* Collapse toggle — desktop only */}
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          aria-label={translateText(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
        >
          {collapsed ? <MdChevronRight /> : <MdChevronLeft />}
        </button>
      </aside>
    </>
  );
}
