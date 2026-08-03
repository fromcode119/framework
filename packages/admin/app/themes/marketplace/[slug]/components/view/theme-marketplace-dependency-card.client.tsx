import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';

export class ThemeMarketplaceDependencyCard extends PureReactor {
  @prop declare theme: IMarketplaceTheme;
  @prop declare adminTheme: ThemeMode;

  render(): ReactNode {
    const { theme, adminTheme } = this;
    if (!theme.dependencies || Object.keys(theme.dependencies).length === 0) return null;

    return (
      <Card className={`border-0 p-4 rounded-xl ${adminTheme === ThemeMode.DARK ? 'bg-indigo-500/5' : 'bg-indigo-50/50'}`}>
        <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${adminTheme === ThemeMode.DARK ? 'text-indigo-400' : 'text-indigo-600'}`}>
          <FrameworkIcons.Puzzle size={16} />
          Dependency Guard
        </h3>
        <div className="space-y-3">
          {Object.entries(theme.dependencies).map(([slug, version]) => (
            <div key={slug} className={`flex items-center justify-between p-3 rounded-lg border ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-col">
                <span className={`text-xs font-bold tracking-tight ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{slug}</span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Requires {version}</span>
              </div>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${adminTheme === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <FrameworkIcons.Check size={14} className="text-emerald-500" />
              </div>
            </div>
          ))}
          <p className="text-[10px] font-medium text-slate-400 italic leading-relaxed pt-2">
            Dependencies are automatically resolved and installed alongside the theme.
          </p>
        </div>
      </Card>
    );
  }
}
