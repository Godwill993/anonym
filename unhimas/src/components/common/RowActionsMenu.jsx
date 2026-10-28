import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdMoreVert } from 'react-icons/md';
import { useTranslation } from '../../i18n';

/**
 * Single "⋯" control that opens a compact menu of row actions.
 * items: { id?, label, icon?, onClick, disabled?, danger?, hidden? }[]
 */
export default function RowActionsMenu({ items = [], ariaLabel }) {
  const { translateText } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const visible = (items || []).filter((item) => item && !item.hidden);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (
        menuRef.current?.contains(e.target) ||
        btnRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onScroll = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const placeMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 220;
    const left = Math.min(
      window.innerWidth - menuWidth - 8,
      Math.max(8, rect.right - menuWidth),
    );
    const top = rect.bottom + 4;
    setPos({ top, left });
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    placeMenu();
    setOpen(true);
  };

  const label = ariaLabel || translateText('Actions');

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="row-actions-menu"
          role="menu"
          aria-label={label}
          style={{ top: pos.top, left: pos.left }}
        >
          {visible.map((item, index) => (
            <button
              key={item.id || `${item.label}-${index}`}
              type="button"
              role="menuitem"
              className={`row-actions-item${item.danger ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.icon ? <span className="row-actions-icon">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="row-actions">
      <button
        ref={btnRef}
        type="button"
        className={`btn-icon row-actions-trigger${open ? ' is-open' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <MdMoreVert />
      </button>
      {menu}
    </div>
  );
}
