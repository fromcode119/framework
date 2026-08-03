import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';

export class AssistantSettingsConnectionSection extends PureReactor {
  @prop declare providerNeedsApiKey: boolean;
  @prop declare hasSavedSecret: boolean;
  @prop declare apiKeyPlaceholder: string;
  @prop declare baseUrlPlaceholder: string;
  @prop declare localApiKey: string;
  @prop declare localBaseUrl: string;
  @prop declare showApiKey: boolean;
  @prop declare onApiKeyChange: (value: string) => void;
  @prop declare onBaseUrlChange: (value: string) => void;
  @prop declare onToggleApiKeyVisibility: () => void;

  @bound
  protected onApiKeyInput(event: ChangeEvent<HTMLInputElement>): void {
    this.onApiKeyChange(event.target.value);
  }

  @bound
  protected onBaseUrlInput(event: ChangeEvent<HTMLInputElement>): void {
    this.onBaseUrlChange(event.target.value);
  }

  private renderApiKeyField(): ReactNode {
    if (!this.providerNeedsApiKey) {
      return null;
    }
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-sub)]">
          API Key {this.hasSavedSecret && '(encrypted)'}
        </label>
        <div className="relative">
          <input
            type={this.showApiKey ? 'text' : 'password'}
            value={this.localApiKey}
            onChange={this.onApiKeyInput}
            autoComplete="new-password"
            placeholder={this.hasSavedSecret ? '••••••••••••••••' : this.apiKeyPlaceholder}
            className={`${GlassMorphism.GLASS_INPUT} w-full pr-10 text-sm`}
          />
          <button
            type="button"
            onClick={this.onToggleApiKeyVisibility}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-sub)] hover:text-[var(--text-main)]"
            aria-label={this.showApiKey ? 'Hide API key' : 'Show API key'}
          >
            {this.showApiKey ? <FrameworkIcons.Lock size={16} /> : <FrameworkIcons.Eye size={16} />}
          </button>
        </div>
        {this.hasSavedSecret && !this.localApiKey ? (
          <p className="mt-1.5 text-xs text-[var(--text-sub)]">Leave empty to keep existing key</p>
        ) : null}
      </div>
    );
  }

  render(): ReactNode {
    return (
      <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
        <div className="mb-3 flex items-center gap-2">
          <FrameworkIcons.Key size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connection</h3>
        </div>
        <div className="space-y-4">
          {this.renderApiKeyField()}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-sub)]">Base URL (optional)</label>
            <input
              type="url"
              value={this.localBaseUrl}
              onChange={this.onBaseUrlInput}
              autoComplete="url"
              placeholder={this.baseUrlPlaceholder}
              className={`${GlassMorphism.GLASS_INPUT} w-full text-sm`}
            />
            <p className="mt-1.5 text-xs text-[var(--text-sub)]">Override provider endpoint when needed</p>
          </div>
        </div>
      </section>
    );
  }
}
