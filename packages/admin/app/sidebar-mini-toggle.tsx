import type { ReactNode } from 'react';

import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
export class SidebarMiniToggle extends PureReactor {
  @prop declare isMini: boolean | undefined;
  @prop declare onMiniToggle: (() => void) | undefined;

  render(): ReactNode {
    const isMini = this.isMini;
    const onMiniToggle = this.onMiniToggle;
    return (
      <div className={`border-t fc-tone-line hidden lg:block fc-canvas  ${isMini ? 'p-2' : 'px-3 py-3'}`}>
        <button
          type="button"
          onClick={onMiniToggle}
          aria-label={AdminI18n.t(isMini ? 'shell.nav.expand' : 'shell.nav.collapse')}
          title={AdminI18n.t(isMini ? 'shell.nav.expand' : 'shell.nav.collapse')}
          className={`flex items-center justify-center ${AdminClass.SURFACE} transition-all duration-300 fc-tone-hover fc-tone-muted font-medium ${isMini ? 'w-10 h-10 shadow-sm shadow-indigo-500/5' : 'w-full p-2.5 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none fc-tone-raised'}`}
        >
          <div className={`transition-transform duration-500 ${isMini ? 'rotate-180' : ''}`}>
             <FrameworkIcons.Left size={18} strokeWidth={2.5} />
          </div>
          {!isMini && <span className="ms-3 text-[12px] font-medium tracking-tight fc-tone-muted transition-colors">{AdminI18n.t('shell.nav.collapse')}</span>}
        </button>
      </div>
    );
  }
}
