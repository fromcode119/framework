import type { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '@ai/ui/select';
import type { SelectOption } from '@ai/ui/select-option';
import { AssistantProviderUtils } from '@ai/assistant-provider-utils';
import { GlassMorphism } from '@ai/ui/glass-morphism';

/**
 * Gateway (provider / model / connection) setup aside. Presentational → `PureReactor`; props via `@prop`,
 * form + input callbacks are `@bound` methods passed by name — no hooks, no raw React.
 */
export class GatewayPanel extends PureReactor {
  @prop declare showGateway: boolean;
  @prop declare setShowGateway: Dispatch<SetStateAction<boolean>>;
  @prop declare provider: string;
  @prop declare switchProvider: (provider: string) => void;
  @prop declare providerOptions: SelectOption[];
  @prop declare model: string;
  @prop declare setModel: Dispatch<SetStateAction<string>>;
  @prop declare modelOptions: SelectOption[];
  @prop declare loadingProviderModels: boolean;
  @prop declare providerModelsError: string;
  @prop declare hasSavedSecret: boolean;
  @prop declare apiKey: string;
  @prop declare setApiKey: Dispatch<SetStateAction<string>>;
  @prop declare baseUrl: string;
  @prop declare setBaseUrl: Dispatch<SetStateAction<string>>;
  @prop declare integrationSaving: boolean;
  @prop declare saveIntegration: () => Promise<void>;
  @prop declare openAdvancedAiSettings: () => void;

  private get providerNeedsApiKey(): boolean {
    return AssistantProviderUtils.providerRequiresApiKey(this.provider);
  }

  private get baseUrlPlaceholder(): string {
    return AssistantProviderUtils.providerBaseUrlPlaceholder(this.provider);
  }

  @bound
  protected closeGateway(): void {
    this.setShowGateway(false);
  }

  @bound
  protected onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void this.saveIntegration();
  }

  @bound
  protected onApiKeyInput(event: ChangeEvent<HTMLInputElement>): void {
    this.setApiKey(event.target.value);
  }

  @bound
  protected onBaseUrlInput(event: ChangeEvent<HTMLInputElement>): void {
    this.setBaseUrl(event.target.value);
  }

  render(): ReactNode {
    return (
      <aside
        className={`relative z-[60] order-last flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-white/50 bg-white/70 backdrop-blur-2xl transition-none dark:border-white/12 dark:bg-slate-900/40 ${
          this.showGateway
            ? 'w-[360px] max-w-[92vw] p-4 opacity-100'
            : 'pointer-events-none w-0 border-transparent px-0 py-0 opacity-0'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Gateway Setup</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Provider, model, and connection profile.</p>
          </div>
          <button
            type="button"
            onClick={this.closeGateway}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            aria-label="Close gateway settings"
          >
            <FrameworkIcons.X size={14} />
          </button>
        </div>

        <form className="space-y-3 overflow-y-auto pr-1" onSubmit={this.onSubmit}>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Provider</label>
            <Select value={this.provider} onChange={this.switchProvider} options={this.providerOptions} searchable={false} />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Model</label>
            <Select value={this.model} onChange={this.setModel} options={this.modelOptions} />
            {this.loadingProviderModels ? <p className="mt-1 text-[11px] text-slate-400">Loading models...</p> : null}
            {this.providerModelsError ? <p className="mt-1 text-[11px] text-amber-200">{this.providerModelsError}</p> : null}
          </div>

          {this.providerNeedsApiKey ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                API Key {this.hasSavedSecret ? '(saved key exists)' : ''}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={this.apiKey}
                onChange={this.onApiKeyInput}
                placeholder={AssistantProviderUtils.providerApiKeyPlaceholder(this.provider)}
                className="h-11 w-full rounded-xl border border-white/65 bg-white/72 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/12 dark:bg-slate-900/44 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400/65"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Base URL (optional)</label>
            <input
              type="text"
              value={this.baseUrl}
              onChange={this.onBaseUrlInput}
              placeholder={this.baseUrlPlaceholder}
              className="h-11 w-full rounded-xl border border-white/65 bg-white/72 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/12 dark:bg-slate-900/44 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400/65"
            />
          </div>

          <button
            type="submit"
            disabled={this.integrationSaving}
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--text-main)] text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {this.integrationSaving ? 'Saving...' : 'Save Gateway'}
          </button>
          <button
            type="button"
            onClick={this.openAdvancedAiSettings}
            className={`${GlassMorphism.GLASS_BUTTON} h-11 w-full text-sm font-semibold`}
          >
            Open Advanced Integration
          </button>
        </form>
      </aside>
    );
  }
}
