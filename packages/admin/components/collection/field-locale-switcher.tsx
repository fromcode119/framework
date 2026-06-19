import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { FieldLocaleSwitcherProps } from './field-renderer.interfaces';

export class FieldLocaleSwitcher extends React.Component<FieldLocaleSwitcherProps> {
  render(): React.ReactNode {
    const { compact = false, theme, activeLocale, activeLocaleCode, localeRegistry, isOpen, onToggle, onSelect, menuRef } = this.props;
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold tracking-wide transition-all ${
            compact ? 'h-7 px-2 text-[10px]' : 'px-2.5 py-1 text-[10px]'
          } ${
            theme === 'dark'
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-indigo-500/60'
              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'
          }`}
        >
          <FrameworkIcons.Globe size={11} />
          <span>{(activeLocaleCode || activeLocale || 'en').toUpperCase()}</span>
          <FrameworkIcons.Down size={11} className={`${isOpen ? 'rotate-180' : ''} transition-transform`} />
        </button>

        {isOpen && (
          <div
            className={`absolute right-0 mt-2 min-w-[220px] rounded-xl border shadow-xl z-30 p-1.5 ${
              theme === 'dark'
                ? 'bg-slate-950 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            {localeRegistry.map((locale) => {
              const isActive = locale.code === activeLocale;
              return (
                <button
                  key={locale.code}
                  type="button"
                  onClick={() => onSelect(locale.code)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : theme === 'dark'
                        ? 'text-slate-200 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{locale.label}</span>
                  <span className={`ml-2 ${isActive ? 'text-indigo-100' : 'opacity-70'}`}>{locale.code.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}
