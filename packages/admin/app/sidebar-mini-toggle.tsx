import type { ReactNode } from 'react';

import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';
export class SidebarMiniToggle extends PureReactor {
  @prop declare isMini: boolean | undefined;
  @prop declare onMiniToggle: (() => void) | undefined;

  render(): ReactNode {
    const isMini = this.isMini;
    const onMiniToggle = this.onMiniToggle;
    return (
      <div className={`absolute bottom-0 left-0 right-0 border-t border-slate-100 dark:border-slate-800 hidden lg:block bg-white dark:bg-[#020617] z-50 ${isMini ? 'p-2.5' : 'p-4'}`}>
        <button
          onClick={onMiniToggle}
          className={`flex items-center justify-center ${AdminClass.SURFACE} transition-all duration-300 hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400 font-bold ${isMini ? 'w-10 h-10 shadow-sm shadow-indigo-500/5' : 'w-full p-2.5 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none bg-slate-50/50 dark:bg-slate-900/40'}`}
        >
          <div className={`transition-transform duration-500 ${isMini ? 'rotate-180' : ''}`}>
             <FrameworkIcons.Left size={18} strokeWidth={2.5} />
          </div>
          {!isMini && <span className="ml-3 text-[11px] font-bold tracking-tight text-slate-500 transition-colors uppercase">Collapse Sidebar</span>}
        </button>
      </div>
    );
  }
}
