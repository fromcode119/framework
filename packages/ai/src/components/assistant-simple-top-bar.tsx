import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AiText } from '@ai/i18n/ai-text';
import { AssistantConstants } from '@ai/constants/assistant.constants';

export class AssistantSimpleTopBar extends PureReactor {
  @prop declare sessionTitle?: string;
  @prop declare historyCount?: number;
  @prop declare onBackToAdmin: () => void;
  @prop declare onHistoryToggle: () => void;
  @prop declare onSettingsOpen: () => void;
  @prop declare onThemeToggle: () => void;
  @prop declare themeMode: ThemeMode;

  private get title(): string {
    return this.sessionTitle ?? AssistantConstants.SURFACE_NAME;
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
            title={AiText.t('ai.backToAdmin')}
            aria-label={AiText.t('ai.backToAdmin')}
          >
            <FrameworkIcons.Home size={14} />
          </button>
          <button
            type="button"
            onClick={this.onHistoryToggle}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            title={AiText.t('ai.toggleHistory')}
            aria-label={AiText.t('ai.toggleHistory')}
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
            title={AiText.t('ai.toggleSettings')}
            aria-label={AiText.t('ai.toggleSettings')}
          >
            <FrameworkIcons.More size={14} />
          </button>
          <button
            type="button"
            onClick={this.onThemeToggle}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            title={(this.themeMode === ThemeMode.DARK ? AiText.t('ai.switchToLight') : AiText.t('ai.switchToDark'))}
            aria-label={AiText.t('ai.toggleTheme')}
          >
            {this.themeMode === ThemeMode.DARK ? <FrameworkIcons.Sun size={13} /> : <FrameworkIcons.Moon size={13} />}
          </button>
        </div>
      </header>
    );
  }
}
