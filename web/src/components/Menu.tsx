import { useEffect, useRef, useState, type ReactNode } from 'react';

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  action: () => void;
};

function Menu({ items, onClose, style }: { items: MenuItem[]; onClose: () => void; style: React.CSSProperties }) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu') && !target.closest('.dropdown')) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div className="context-menu" style={style}>
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={`menu-item ${item.danger ? 'danger' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            item.action();
            onClose();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ContextMenuWrapper({
  children,
  items,
}: {
  children: ReactNode;
  items: MenuItem[] | ((e: React.MouseEvent) => MenuItem[]);
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const eventRef = useRef<React.MouseEvent | null>(null);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    eventRef.current = e;
    setPos({ x: e.clientX, y: e.clientY });
  };

  const close = () => setPos(null);

  return (
    <>
      <div onContextMenu={handleContext}>
        {children}
      </div>
      {pos && (
        <>
          <div className="context-overlay" onClick={close} />
          <Menu items={typeof items === 'function' ? items(eventRef.current!) : items} onClose={close} style={{
            position: 'fixed',
            left: Math.min(pos.x, window.innerWidth - 200),
            top: Math.min(pos.y, window.innerHeight - 200),
          }} />
        </>
      )}
    </>
  );
}

export function DropdownMenu({
  trigger,
  items,
  align = 'right',
  direction = 'auto',
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  direction?: 'up' | 'down' | 'auto';
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let flipUp = false;
      if (direction === 'up') flipUp = true;
      else if (direction === 'down') flipUp = false;
      else flipUp = (window.innerHeight - rect.bottom) < 220;

      setMenuStyle({
        position: 'fixed',
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + 4, [align]: window.innerWidth - rect.right }
          : { top: rect.bottom + 4, [align]: window.innerWidth - rect.right }),
        zIndex: 200,
      });
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={(e) => { e.stopPropagation(); toggle(); }} style={{ cursor: 'pointer' }}>
        {trigger}
      </span>
      {open && (
        <Menu
          items={items}
          onClose={() => setOpen(false)}
          style={menuStyle}
        />
      )}
    </div>
  );
}
