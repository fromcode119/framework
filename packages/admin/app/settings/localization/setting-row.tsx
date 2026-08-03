import { ThemeMode } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';

export class SettingRow extends PureReactor {
  @prop declare icon: ComponentType<{ size?: number }> | undefined;
  @prop declare title: ReactNode;
  @prop declare description: ReactNode;
  @prop declare children: ReactNode;
  @prop declare theme: ThemeMode;

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  render(): ReactNode {
    const Icon = this.icon;
    return (
      <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${this.isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex gap-4">
          <div className={`p-2.5 rounded-xl h-fit ${this.isDark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            {Icon ? <Icon size={20} /> : <div className="w-5 h-5" />}
          </div>
          <div>
            <h3 className={`font-semibold ${this.isDark ? 'text-slate-200' : 'text-slate-900'}`}>{this.title}</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{this.description}</p>
          </div>
        </div>
        <div className="flex-shrink-0">{this.children}</div>
      </div>
    );
  }
}
