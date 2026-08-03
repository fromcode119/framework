import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginEntry } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';

export class MarketplaceChangelog extends PureReactor {
  @prop declare plugin: IPluginEntry;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { plugin, theme } = this;
    if (!plugin.changelog || plugin.changelog.length === 0) return null;

    return (
      <div className="space-y-4">
         <div className="flex items-center gap-4">
            <div className={`h-8 w-1.5 rounded-full ${theme === ThemeMode.DARK ? 'bg-indigo-500/40' : 'bg-indigo-600'}`}></div>
            <h3 className={`text-[11px] font-bold uppercase tracking-widest ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-900/40'}`}>Technical Changelog</h3>
            <div className={`h-px flex-1 ${theme === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-200/60'}`}></div>
         </div>

         <div className={`${AdminClass.SURFACE} overflow-hidden`}>
            <ul className={`divide-y ${theme === ThemeMode.DARK ? 'divide-slate-800/50' : 'divide-slate-50'}`}>
               {plugin.changelog.map((log, idx) => (
                 <li key={idx} className={`p-4 flex items-start gap-4 transition-all duration-300 group ${theme === ThemeMode.DARK ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/30'}`}>
                    <div className={`mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                      theme === ThemeMode.DARK
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/20'
                    }`}>
                       <FrameworkIcons.Check size={14} strokeWidth={3} />
                    </div>
                    <div className="flex-1 space-y-1">
                       <p className={`text-[13px] font-semibold leading-relaxed ${theme === ThemeMode.DARK ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                          {log}
                       </p>
                    </div>
                 </li>
               ))}
            </ul>
         </div>
      </div>
    );
  }
}
