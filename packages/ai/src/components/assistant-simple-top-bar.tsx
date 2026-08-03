import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';

export class AssistantSimpleTopBar extends PureReactor {
  @prop declare sessionTitle?: string;
  @prop declare historyCount?: number;
  @prop declare onBackToAdmin: () => void;
  @prop declare onHistoryToggle: () => void;
  @prop declare onSettingsOpen: () => void;
  @prop declare onThemeToggle: () => void;
  @prop declare themeMode: ThemeMode;

  private get title(): string {
    return this.sessionTitle ?? 'Atlantis Intelligence';
  }

  private get count(): number {
    return this.historyCount ?? 0;
  }

  render(): ReactNode {
    return (
      <header className="relative z-20 flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={this.onBackToAdmin}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            title="Back to admin"
            aria-label="Back to admin"
          >
            <FrameworkIcons.Home size={14} />
          </button>
          <button
            type="button"
            onClick={this.onHistoryToggle}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            title="Toggle history"
            aria-label="Toggle history"
          >
            <FrameworkIcons.Menu size={14} />
          </button>
          <div className="hidden rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-semibold text-[var(--text-main)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/40 sm:inline-flex">
            {this.title}
            {this.count > 0 ? ` • ${this.count}` : ''}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={this.onSettingsOpen}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            title="Toggle settings"
            aria-label="Toggle settings"
          >
            <FrameworkIcons.More size={14} />
          </button>
          <button
            type="button"
            onClick={this.onThemeToggle}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            title={`Switch to ${this.themeMode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK} mode`}
            aria-label="Toggle theme"
          >
            {this.themeMode === ThemeMode.DARK ? <FrameworkIcons.Sun size={13} /> : <FrameworkIcons.Moon size={13} />}
          </button>
        </div>
      </header>
    );
  }
}
