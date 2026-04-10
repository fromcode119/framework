'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../ui/glass-morphism';
import { AssistantProviderUtils } from '../assistant-provider-utils';
import { AssistantSettingsDrawerFrame } from './assistant-settings-drawer/assistant-settings-drawer-frame';
import type { AssistantSettingsDrawerProps } from './assistant-settings-drawer/assistant-settings-drawer.interfaces';
import { AssistantSettingsConnectionSection } from './assistant-settings-drawer/assistant-settings-connection-section';
import { AssistantSettingsPreferencesSection } from './assistant-settings-drawer/assistant-settings-preferences-section';
import { AssistantSettingsProviderSection } from './assistant-settings-drawer/assistant-settings-provider-section';

export function AssistantSettingsDrawer({
  isOpen,
  onClose,
  presentation = 'overlay',
  onRequestClose,
  provider,
  onProviderChange,
  providerOptions,
  model,
  onModelChange,
  modelOptions,
  loadingModels,
  modelsError,
  skillId,
  onSkillIdChange,
  skillOptions,
  apiKey,
  onApiKeyChange,
  hasSavedSecret,
  baseUrl,
  onBaseUrlChange,
  onSave,
  isSaving,
  autoApprove = false,
  onAutoApproveChange,
  showTechnicalDetails = false,
  onShowTechnicalDetailsChange,
  verboseLogging = false,
  onVerboseLoggingChange,
}: AssistantSettingsDrawerProps) {
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [localApiKey, setLocalApiKey] = React.useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = React.useState(baseUrl);
  const providerNeedsApiKey = AssistantProviderUtils.providerRequiresApiKey(provider);
  const apiKeyPlaceholder = AssistantProviderUtils.providerApiKeyPlaceholder(provider);
  const baseUrlPlaceholder = AssistantProviderUtils.providerBaseUrlPlaceholder(provider);

  React.useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  React.useEffect(() => {
    setLocalBaseUrl(baseUrl);
  }, [baseUrl]);

  const handleSave = async () => {
    await onSave({
      apiKey: localApiKey,
      baseUrl: localBaseUrl,
    });
  };
  const handleRequestClose = React.useCallback(() => {
    setLocalApiKey(apiKey);
    setLocalBaseUrl(baseUrl);
    setShowApiKey(false);
    if (onRequestClose) onRequestClose();
    else onClose();
  }, [apiKey, baseUrl, onClose, onRequestClose]);
  const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSave();
  }, [handleSave]);

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
      <AssistantSettingsDrawerFrame
        isOpen={isOpen}
        presentation={presentation}
        onRequestClose={handleRequestClose}
      >
        <form className="contents" onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-6">
          <span id="settings-title" className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-sub)] opacity-70">
            Parameters
          </span>
          <button
            type="button"
            onClick={handleRequestClose}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            aria-label="Close settings"
          >
            <FrameworkIcons.X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            <AssistantSettingsProviderSection
              provider={provider}
              onProviderChange={onProviderChange}
              providerOptions={providerOptions}
              model={model}
              onModelChange={onModelChange}
              modelOptions={modelOptions}
              loadingModels={loadingModels}
              modelsError={modelsError}
              skillId={skillId}
              onSkillIdChange={onSkillIdChange}
              skillOptions={skillOptions}
            />
            <AssistantSettingsConnectionSection
              providerNeedsApiKey={providerNeedsApiKey}
              hasSavedSecret={hasSavedSecret}
              apiKeyPlaceholder={apiKeyPlaceholder}
              baseUrlPlaceholder={baseUrlPlaceholder}
              localApiKey={localApiKey}
              localBaseUrl={localBaseUrl}
              showApiKey={showApiKey}
              onApiKeyChange={setLocalApiKey}
              onBaseUrlChange={setLocalBaseUrl}
              onToggleApiKeyVisibility={() => setShowApiKey(!showApiKey)}
            />
            <AssistantSettingsPreferencesSection
              autoApprove={autoApprove}
              onAutoApproveChange={onAutoApproveChange}
              showTechnicalDetails={showTechnicalDetails}
              onShowTechnicalDetailsChange={onShowTechnicalDetailsChange}
              verboseLogging={verboseLogging}
              onVerboseLoggingChange={onVerboseLoggingChange}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              className={`${GlassMorphism.GLASS_BUTTON} px-4 py-2 text-sm font-medium`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`${GlassMorphism.GLASS_BUTTON} group relative overflow-hidden px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isSaving ? (
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
