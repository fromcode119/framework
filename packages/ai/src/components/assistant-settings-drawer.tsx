import { DrawerPresentation } from '@ai/enums/drawer-presentation.enum';
import type { FormEvent, ReactNode } from 'react';
import { Reactor, prop, state, bound, watch } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import type { SelectOption } from '@ai/ui/select-option';
import { AssistantProviderUtils } from '@ai/assistant-provider-utils';
import { AssistantSettingsDrawerFrame } from '@ai/components/assistant-settings-drawer/assistant-settings-drawer-frame';
import { AssistantSettingsConnectionSection } from '@ai/components/assistant-settings-drawer/assistant-settings-connection-section';
import { AssistantSettingsPreferencesSection } from '@ai/components/assistant-settings-drawer/assistant-settings-preferences-section';
import { AssistantSettingsProviderSection } from '@ai/components/assistant-settings-drawer/assistant-settings-provider-section';

/**
 * Assistant settings drawer. Stateful → `Reactor`; local api-key/base-url mirrors are `@state`, kept in
 * sync with the incoming props via `@watch`, and every handler is a `@bound` method.
 */
export class AssistantSettingsDrawer extends Reactor {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare presentation?: DrawerPresentation;
  @prop declare onRequestClose?: () => void;
  @prop declare provider: string;
  @prop declare onProviderChange: (provider: string) => void;
  @prop declare providerOptions: SelectOption[];
  @prop declare model: string;
  @prop declare onModelChange: (model: string) => void;
  @prop declare modelOptions: SelectOption[];
  @prop declare loadingModels: boolean;
  @prop declare modelsError: string;
  @prop declare skillId: string;
  @prop declare onSkillIdChange: (skillId: string) => void;
  @prop declare skillOptions: SelectOption[];
  @prop declare apiKey: string;
  @prop declare hasSavedSecret: boolean;
  @prop declare baseUrl: string;
  @prop declare onSave: (values: { apiKey: string; baseUrl: string }) => Promise<void>;
  @prop declare isSaving: boolean;
  @prop declare autoApprove: boolean;
  @prop declare onAutoApproveChange: (value: boolean) => void;
  @prop declare showTechnicalDetails: boolean;
  @prop declare onShowTechnicalDetailsChange: (value: boolean) => void;
  @prop declare verboseLogging: boolean;
  @prop declare onVerboseLoggingChange: (value: boolean) => void;

  @state showApiKey = false;
  @state localApiKey = '';
  @state localBaseUrl = '';

  componentDidMount(): void {
    // Seed the editable mirrors from props before first paint; @watch keeps them synced afterwards.
    this.localApiKey = this.apiKey;
    this.localBaseUrl = this.baseUrl;
  }

  private get resolvedPresentation(): DrawerPresentation {
    return this.presentation ?? DrawerPresentation.OVERLAY;
  }

  private get providerNeedsApiKey(): boolean { return AssistantProviderUtils.providerRequiresApiKey(this.provider); }
  private get apiKeyPlaceholder(): string { return AssistantProviderUtils.providerApiKeyPlaceholder(this.provider); }
  private get baseUrlPlaceholder(): string { return AssistantProviderUtils.providerBaseUrlPlaceholder(this.provider); }

  @watch('apiKey')
  protected onApiKeyProp(): void { this.localApiKey = this.apiKey; }

  @watch('baseUrl')
  protected onBaseUrlProp(): void { this.localBaseUrl = this.baseUrl; }

  @bound protected setLocalApiKey(value: string): void { this.localApiKey = value; }
  @bound protected setLocalBaseUrl(value: string): void { this.localBaseUrl = value; }
  @bound protected onToggleApiKey(): void { this.showApiKey = !this.showApiKey; }

  @bound
  protected onRequestCloseClick(): void {
    this.localApiKey = this.apiKey;
    this.localBaseUrl = this.baseUrl;
    this.showApiKey = false;
    if (this.onRequestClose) this.onRequestClose();
    else this.onClose();
  }

  private async save(): Promise<void> {
    await this.onSave({ apiKey: this.localApiKey, baseUrl: this.localBaseUrl });
  }

  @bound
  protected onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void this.save();
  }

  render(): ReactNode {
    return (
      <>
        <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slide-out-right {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
      `}</style>
        <AssistantSettingsDrawerFrame isOpen={this.isOpen} presentation={this.resolvedPresentation} onRequestClose={this.onRequestCloseClick}>
          <form className="contents" onSubmit={this.onSubmit}>
            <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-6">
              <span id="settings-title" className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-sub)] opacity-70">
                Parameters
              </span>
              <button type="button" onClick={this.onRequestCloseClick} className={GlassMorphism.GLASS_ICON_BUTTON} aria-label="Close settings">
                <FrameworkIcons.X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-8">
                <AssistantSettingsProviderSection
                  provider={this.provider}
                  onProviderChange={this.onProviderChange}
                  providerOptions={this.providerOptions}
                  model={this.model}
                  onModelChange={this.onModelChange}
                  modelOptions={this.modelOptions}
                  loadingModels={this.loadingModels}
                  modelsError={this.modelsError}
                  skillId={this.skillId}
                  onSkillIdChange={this.onSkillIdChange}
                  skillOptions={this.skillOptions}
                />
                <AssistantSettingsConnectionSection
                  providerNeedsApiKey={this.providerNeedsApiKey}
                  hasSavedSecret={this.hasSavedSecret}
                  apiKeyPlaceholder={this.apiKeyPlaceholder}
                  baseUrlPlaceholder={this.baseUrlPlaceholder}
                  localApiKey={this.localApiKey}
                  localBaseUrl={this.localBaseUrl}
                  showApiKey={this.showApiKey}
                  onApiKeyChange={this.setLocalApiKey}
                  onBaseUrlChange={this.setLocalBaseUrl}
                  onToggleApiKeyVisibility={this.onToggleApiKey}
                />
                <AssistantSettingsPreferencesSection
                  autoApprove={this.autoApprove}
                  onAutoApproveChange={this.onAutoApproveChange}
                  showTechnicalDetails={this.showTechnicalDetails}
                  onShowTechnicalDetailsChange={this.onShowTechnicalDetailsChange}
                  verboseLogging={this.verboseLogging}
                  onVerboseLoggingChange={this.onVerboseLoggingChange}
                />
              </div>
            </div>

            <div className="border-t border-[var(--border)] px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={this.onRequestCloseClick} className={`${GlassMorphism.GLASS_BUTTON} px-4 py-2 text-sm font-medium`}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={this.isSaving}
                  className={`${GlassMorphism.GLASS_BUTTON} group relative overflow-hidden px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {this.isSaving ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Saving</span>
                      </div>
                      <div className="absolute inset-0 animate-pulse bg-white/10" style={{ animationDuration: '1.5s' }} />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <FrameworkIcons.Check size={16} className="transition-transform group-hover:scale-110" />
                        <span>Save Changes</span>
                      </div>
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </AssistantSettingsDrawerFrame>
      </>
    );
  }
}
