import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

export class ActivityPageHeader extends PureReactor {
  @prop declare mode: ActivityMode;
  @prop declare theme: ThemeMode;
  @prop declare searchQuery: string;
  @prop declare onModeChange: (mode: ActivityMode) => void;
  @prop declare onSearchQueryChange: (value: string) => void;
  @prop declare onSearch: (e: FormEvent) => void;

  @bound
  protected selectSystemMode(): void {
    this.onModeChange(ActivityMode.SYSTEM);
  }

  @bound
  protected selectSecurityMode(): void {
    this.onModeChange(ActivityMode.SECURITY);
  }

  @bound
  protected changeSearchQuery(e: ChangeEvent<HTMLInputElement>): void {
    this.onSearchQueryChange(e.target.value);
  }

  render(): ReactNode {
    const mode = this.mode;
    const theme = this.theme;
    return (
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Activity size={18} strokeWidth={2.5} />}
        title={mode === ActivityMode.SYSTEM ? 'System Activity' : 'Security Audit'}
        subtitle="Global ledger of administrative actions and security events."
        actions={
          <>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
              <button
                onClick={this.selectSystemMode}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all ${
                  mode === ActivityMode.SYSTEM
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                System Events
              </button>
              <button
                onClick={this.selectSecurityMode}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all ${
                  mode === ActivityMode.SECURITY
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Security Audit
              </button>
            </div>
            <form onSubmit={this.onSearch} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Search ${mode} logs...`}
                value={this.searchQuery}
                onChange={this.changeSearchQuery}
                className={`px-3 h-9 rounded-lg border text-xs font-medium outline-none transition-all w-48 ${
                  theme === ThemeMode.DARK
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'
                }`}
              />
              <Button
                type="submit"
                variant={ButtonVariant.SECONDARY}
                className="px-4 h-9 rounded-lg font-semibold text-xs"
                icon={<FrameworkIcons.Search size={15} />}
              >
                Filter history
              </Button>
            </form>
          </>
        }
      />
    );
  }
}
