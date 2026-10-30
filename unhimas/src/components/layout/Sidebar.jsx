import { NavLink, useLocation } from 'react-router-dom';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { NAV_CONFIG } from '../../constants/navConfig';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { useTranslation } from '../../i18n';
import logo from '../../assets/logo.png';

function isPathActive(pathname, path) {
  if (!path) return false;
  if (pathname === path) return true;
  if (
    path !== '/admin' &&
    path !== '/lecturer' &&
    path !== '/student' &&
    pathname.startsWith(path)
  ) {
    return true;
  }
  return false;
}

function filterItems(items, profile) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const children = item.children ? filterItems(item.children, profile) : undefined;
      const allowed = !item.capability || can(profile, item.capability);
      if (!allowed && !(children && children.length)) return null;
      return {
        ...item,
        children: children && children.length ? children : undefined,
      };
    })
    .filter(Boolean);
}

function NavItem({ item, collapsed, onMobileClose, depth = 0 }) {
  const location = useLocation();
  const { translateText } = useTranslation();
  const Icon = item.icon;
  const childActive =
    item.children?.some(
      (c) =>
        isPathActive(location.pathname, c.path) ||
        c.children?.some((gc) => isPathActive(location.pathname, gc.path)),
    ) ?? false;
  const isActive = isPathActive(location.pathname, item.path) && !childActive;
  const showChildren = !collapsed && item.children?.length > 0;

  return (
    <div className={`sidebar-item-block depth-${depth}`}>
      <NavLink
        to={item.path}
        className={`sidebar-item ${isActive || (childActive && depth === 0) ? 'active' : ''} ${depth > 0 ? 'sidebar-item-child' : ''}`}
        title={collapsed ? translateText(item.label) : undefined}
        onClick={onMobileClose}
        aria-current={isActive ? 'page' : undefined}
      >
        {Icon ? (
          <Icon aria-hidden="true" />
        ) : (
          <span className="sidebar-item-dot" aria-hidden="true" />
        )}
        <span className="sidebar-item-label">{translateText(item.label)}</span>
      </NavLink>
      {showChildren && (
        <div className="sidebar-children" role="group" aria-label={translateText(item.label)}>
          {item.children.map((child) => (
            <NavItem
              key={child.key}
              item={child}
              collapsed={collapsed}
              onMobileClose={onMobileClose}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { profile } = useAuth();
  const { translateText } = useTranslation();
  const role = profile?.role || 'student';

  const navGroups = (NAV_CONFIG[role] || [])
    .map((group) => ({
      ...group,
      items: filterItems(group.items, profile),
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
          {navGroups.map((group, idx) => (
            <div className="sidebar-group" key={group.group || `g-${idx}`}>
              {group.group ? (
                <div className="sidebar-group-label">{translateText(group.group)}</div>
              ) : null}
              {group.items.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  collapsed={collapsed}
                  onMobileClose={onMobileClose}
                />
              ))}
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
