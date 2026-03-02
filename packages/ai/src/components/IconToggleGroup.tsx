import React from 'react';

export function IconToggleGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  iconOnly = false,
  fullWidth = false,
}: {
  value: T;
  options: Array<{ value: T; label: string; Icon: React.ComponentType<any> }>;
  onChange: (next: T) => void;
  ariaLabel: string;
  iconOnly?: boolean;
  fullWidth?: boolean;
}) {
  const activeIndex = options.findIndex((option) => option.value === value);
  const isBinaryIconToggle = iconOnly && options.length === 2;

  if (isBinaryIconToggle) {
    return (
      <div
        className="relative inline-grid grid-cols-2 items-center rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-md dark:border-white/10 dark:bg-black/20"
        role="radiogroup"
        aria-label={ariaLabel}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1 top-1 h-9 w-9 rounded-xl bg-white/80 shadow-lg transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:bg-white/10 ${
            activeIndex === 1 ? 'translate-x-9' : 'translate-x-0'
          }`}
        />
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              title={option.label}
              className={`relative z-10 h-9 w-9 rounded-xl text-xs font-bold transition-colors duration-300 inline-flex items-center justify-center ${
                active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <option.Icon size={14} />
              <span className="sr-only">{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-md dark:border-white/10 dark:bg-black/20 ${fullWidth ? 'w-full' : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        const sizeClass = iconOnly ? 'h-9 w-9' : fullWidth ? 'h-9 flex-1 px-4' : 'h-9 px-4';

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={`${sizeClass} rounded-xl text-[11px] font-bold tracking-tight transition-all duration-300 inline-flex items-center justify-center gap-2 ${
              active
                ? 'bg-white/80 text-slate-900 shadow-md dark:bg-white/10 dark:text-white'
                : 'text-slate-500 hover:bg-white/5 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <option.Icon size={14} />
            {iconOnly ? <span className="sr-only">{option.label}</span> : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
