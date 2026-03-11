import React from 'react';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
};

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
}: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) ? (
        <div className="min-w-0">
          {label ? <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</p> : null}
          {description ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
      ) : null}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2'
        } ${checked ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span
          aria-hidden
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
