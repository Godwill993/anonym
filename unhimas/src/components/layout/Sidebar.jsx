import { NavLink, useLocation } from 'react-router-dom';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { NAV_CONFIG } from '../../constants/navConfig';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { can } from '../../lib/permissions';
import logo from '../../assets/unhimas_logo.jpg';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { profile } = useAuth();
  const { translateText } = useTranslation();
  const role = profile?.role || 'student';
  const location = useLocation();

  // Filter groups/items by capability when declared
  const navGroups = (NAV_CONFIG[role] || [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.capability || can(profile, item.capability)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label={translateText('Main navigation')}
      >
        <div className="sidebar-logo">
          <img src={logo} alt="UNHIMAS logo" />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">UNHIMAS</span>
            <span className="sidebar-logo-tagline">{translateText('School Management')}</span>
          </div>
        </div>

        <nav className="sidebar-nav" role="navigation">
          {navGroups.map((group) => (
            <div className="sidebar-group" key={group.group}>
              <div className="sidebar-group-label">{translateText(group.group)}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/admin' &&
                    item.path !== '/lecturer' &&
                    item.path !== '/student' &&
                    item.path !== '/frontdesk' &&
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
