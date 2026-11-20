import type { Ref } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminLink } from '@/components/view/admin-link.client';

export class FieldLocaleSwitcher extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare activeLocale: string;
  @prop declare activeLocaleCode: string;
  @prop declare localeRegistry: Array<{ code: string; label: string }>;
  @prop declare isOpen: boolean;
  @prop declare onToggle: () => void;
  @prop declare onSelect: (code: string) => void;
  @prop declare menuRef: Ref<HTMLDivElement>;

  render(): ReactNode {
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
          // The console has ONE pressable shape. This chip drew its own: a 1px border, 12px text and
          // an indigo hover, so beside a 13/20 .fc-btn in the same drawer it read as a different kit.
          className="fc-btn fc-btn--mini"
        >
          <FrameworkIcons.Globe size={11} />
          <span>{(activeLocaleCode || activeLocale || 'en').toUpperCase()}</span>
          <FrameworkIcons.ChevronDown size={11} className={`${isOpen ? 'rotate-180' : ''} transition-transform`} />
        </button>

        {isOpen && (
          // `role="menu"` also lifts the input's switcher wrapper above the next field while open
          // (`has-[[role=menu]]:z-50` there): the wrapper is its own stacking context at z-20, so
          // raising only this menu left the next field's chip painted over it.
          <div
            role="menu"
            // The sheet every other menu in this console opens in, at the card's corner.
            className={`fc-menu-sheet absolute end-0 mt-2 min-w-[220px] border shadow-lg z-30 ${
              theme === ThemeMode.DARK
                ? 'bg-slate-900 border-slate-800 shadow-black/40'
                : 'bg-white border-slate-200 shadow-slate-900/[0.08]'
            }`}
          >
            {localeRegistry.length ? null : (
              // A site with no languages configured still saves text under a fallback code, so the chip
              // stays; the menu says why it has nothing to switch to and where that is set.
              <p className={`px-2.5 py-2 text-xs font-medium leading-relaxed fc-tone-muted`}>
                {AdminI18n.t('ui.locale.noneConfigured')}{' '}
                <AdminLink className="font-medium text-indigo-600 underline dark:text-indigo-300" href={AdminPathUtils.toAdminPath('/settings/localization')}>
                  {AdminI18n.t('ui.locale.configure')}
                </AdminLink>
              </p>
            )}
            {localeRegistry.map((locale) => {
              const isActive = locale.code === activeLocale;
              return (
                <button
                  key={locale.code}
                  type="button"
                  onClick={() => onSelect(locale.code)}
                  className="fc-menu-action justify-between"
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="truncate">{locale.label}</span>
                  <span className="fc-menu-action__detail ms-2">{locale.code.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}
