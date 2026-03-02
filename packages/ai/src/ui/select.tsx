import React from 'react';
import { createPortal } from 'react-dom';
import { FrameworkIcons } from '@fromcode119/react';

export type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  menuPosition?: 'bottom' | 'top';
  compact?: boolean;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  searchable = true,
  menuPosition = 'bottom',
  compact = false,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = React.useState<{ left: number; top: number; width: number } | null>(null);
  const selected = options.find((item) => item.value === value) || null;

  const filtered = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((item) => item.label.toLowerCase().includes(keyword));
  }, [options, search]);

  const updateMenuPosition = React.useCallback(() => {
    if (!open || !triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 280;
    const viewportPadding = 8;

    let top = rect.bottom + 6;
    if (menuPosition === 'top') {
      top = rect.top - menuHeight - 6;
    }

    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - menuHeight - viewportPadding),
    );

    setMenuStyle({
      left: rect.left,
      top,
      width: rect.width,
    });
  }, [menuPosition, open]);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideRoot = !!(rootRef.current && rootRef.current.contains(target));
      const insideMenu = !!(menuRef.current && menuRef.current.contains(target));
      if (!insideRoot && !insideMenu) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setMenuStyle(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, updateMenuPosition, filtered.length]);

  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => updateMenuPosition(), 0);
    return () => window.clearTimeout(id);
  }, [open, updateMenuPosition, searchable, search]);

  const menuNode =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        style={menuStyle ? { left: menuStyle.left, top: menuStyle.top, width: menuStyle.width } : undefined}
        className={`fixed z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
          menuStyle ? '' : 'opacity-0 pointer-events-none'
        }`}
      >
        {searchable ? (
          <div className="border-b border-slate-200 p-2 dark:border-slate-700">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/25 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-300/70"
            />
          </div>
        ) : null}

        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">No options.</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left text-xs transition last:mb-0 ${
                  option.value === value
                    ? 'bg-cyan-100 text-cyan-900 dark:bg-cyan-300/18 dark:text-cyan-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() =>
          !disabled &&
          setOpen((prev) => {
            const next = !prev;
            if (!next) setMenuStyle(null);
            return next;
          })
        }
        className={`${compact ? 'h-8 rounded-xl px-2.5 text-[11px]' : 'h-11 rounded-xl px-3 text-sm'} w-full border text-left transition inline-flex items-center justify-between gap-2 ${
          disabled
            ? compact
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-600'
              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
            : compact
              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white'
              : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500'
        }`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <FrameworkIcons.Down size={14} />
        </span>
      </button>
      {menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
