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
      <div className={`py-4 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${this.isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex gap-3">
          <div className={`p-2 rounded-lg h-fit ${this.isDark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            {Icon ? <Icon size={18} /> : <div className="w-[18px] h-[18px]" />}
          </div>
          <div>
            <h3 className={`text-sm font-semibold tracking-tight ${this.isDark ? 'text-slate-200' : 'text-slate-900'}`}>{this.title}</h3>
            <p className={`text-[13px] font-normal mt-0.5 max-w-md leading-relaxed ${this.isDark ? 'text-slate-400' : 'text-slate-500'}`}>{this.description}</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {this.children}
        </div>
      </div>
    );
  }
}
