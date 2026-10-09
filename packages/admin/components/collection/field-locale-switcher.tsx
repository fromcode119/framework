import type { Ref } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminPathUtils } from '@/lib/admin-path';

export class FieldLocaleSwitcher extends PureReactor {
  @prop declare compact?: boolean;
  @prop declare theme: ThemeMode;
  @prop declare activeLocale: string;
  @prop declare activeLocaleCode: string;
  @prop declare localeRegistry: Array<{ code: string; label: string }>;
  @prop declare isOpen: boolean;
  @prop declare onToggle: () => void;
  @prop declare onSelect: (code: string) => void;
  @prop declare menuRef: Ref<HTMLDivElement>;

  render(): ReactNode {
    const compact = this.compact ?? false;
    const { theme, activeLocale, activeLocaleCode, localeRegistry, isOpen, onToggle, onSelect, menuRef } = this;
    return (
      // Raise the switcher's own stacking context while the menu is open. The wrapper that positions it
      // over the input is `absolute … z-20`, and the menu is `z-30` INSIDE that context — so against a
      // later sibling field (a two-column settings grid, say) the whole switcher still competes at 20 and
      // the open menu paints underneath the next field. Lifting it only while open keeps the closed
      // state out of the way of everything else.
      <div className={`relative ${isOpen ? 'z-50' : ''}`} ref={menuRef}>
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius)] border font-semibold tracking-wide transition-all ${
            compact ? 'h-7 px-2 text-[10px]' : 'px-2.5 py-1 text-[10px]'
          } ${
            theme === ThemeMode.DARK
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-indigo-500/60'
              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'
          }`}
        >
          <FrameworkIcons.Globe size={11} />
          <span>{(activeLocaleCode || activeLocale || 'en').toUpperCase()}</span>
          <FrameworkIcons.Down size={11} className={`${isOpen ? 'rotate-180' : ''} transition-transform`} />
        </button>

        {isOpen && (
          // `role="menu"` also lifts the input's switcher wrapper above the next field while open
          // (`has-[[role=menu]]:z-50` there): the wrapper is its own stacking context at z-20, so
          // raising only this menu left the next field's chip painted over it.
          <div
            role="menu"
            className={`absolute right-0 mt-2 min-w-[220px] rounded-xl border shadow-xl z-30 p-1.5 ${
              theme === ThemeMode.DARK
                ? 'bg-slate-950 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            {localeRegistry.length ? null : (
              // A site with no languages configured still saves text under a fallback code, so the chip
              // stays; the menu says why it has nothing to switch to and where that is set.
              <p className={`px-2.5 py-2 text-xs font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-600'}`}>
                {AdminI18n.t('ui.locale.noneConfigured')}{' '}
                <a className="font-semibold text-indigo-600 underline dark:text-indigo-300" href={AdminPathUtils.toAdminPath('/settings/localization')}>
                  {AdminI18n.t('ui.locale.configure')}
                </a>
              </p>
            )}
            {localeRegistry.map((locale) => {
              const isActive = locale.code === activeLocale;
              return (
                <button
                  key={locale.code}
                  type="button"
                  onClick={() => onSelect(locale.code)}
                  className={`w-full text-left px-2.5 py-2 rounded-[var(--radius)] text-xs font-medium transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : theme === ThemeMode.DARK
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
