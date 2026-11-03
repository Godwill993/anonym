import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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

  const placeMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 220;
    const estimatedHeight = Math.min(320, 12 + visible.length * 40);
    let left = Math.min(
      window.innerWidth - menuWidth - 8,
      Math.max(8, rect.right - menuWidth),
    );
    let top = rect.bottom + 4;
    // Flip above if not enough space below
    if (top + estimatedHeight > window.innerHeight - 8 && rect.top > estimatedHeight) {
      top = rect.top - estimatedHeight - 4;
    }
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (open) placeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

    const onScrollOrResize = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const toggle = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
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
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 1200,
          }}
        >
          {visible.map((item, index) => (
            <button
              key={item.id || `${item.label}-${index}`}
              type="button"
              role="menuitem"
              className={`row-actions-item${item.danger ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={(ev) => {
                ev.stopPropagation();
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
        <MdMoreVert aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}
