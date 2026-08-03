import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';

export class NewRolePermissionsCard extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<NewRolePermissionsCard, 'theme' | 'permissions' | 'selected' | 'onToggle'>;

  @prop declare theme: ThemeMode;
  @prop declare permissions: any[];
  @prop declare selected: string[];
  @prop declare onToggle: (perm: string) => void;

  render(): ReactNode {
    const { theme, permissions, selected, onToggle } = this;
    return (
      <Card title="Permissions">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Available Options</span>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{selected.length} Selected</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {permissions.map(perm => (
              <div
                key={perm.name}
                onClick={() => onToggle(perm.name)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 flex items-center justify-between group ${
                  selected.includes(perm.name)
                    ? (theme === ThemeMode.DARK ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-indigo-50 border-indigo-200 shadow-md')
                    : (theme === ThemeMode.DARK ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200')
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className={`text-xs font-bold tracking-tight ${selected.includes(perm.name) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                    {perm.name}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight opacity-60">
                    {perm.group || 'General'}
                  </span>
                </div>
                <div className={`h-6 w-6 rounded-lg border flex items-center justify-center transition-all ${
                   selected.includes(perm.name)
                     ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                     : 'bg-transparent border-slate-200 dark:border-slate-800'
                }`}>
                   {selected.includes(perm.name) && <FrameworkIcons.Check size={14} strokeWidth={3} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }
}
