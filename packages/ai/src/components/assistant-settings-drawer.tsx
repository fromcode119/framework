'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '../ui/select';
import { GlassMorphism } from '../ui/glass-morphism';
import { AssistantProviderUtils } from '../assistant-provider-utils';

interface AssistantSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  presentation?: 'docked' | 'overlay';
  onRequestClose?: () => void;
  
  // Provider & Model
  provider: string;
  onProviderChange: (provider: string) => void;
  providerOptions: Array<{ value: string; label: string }>;
  
  model: string;
  onModelChange: (model: string) => void;
  modelOptions: Array<{ value: string; label: string }>;
  loadingModels: boolean;
  modelsError: string;
  
  // Skill
  skillId: string;
  onSkillIdChange: (skillId: string) => void;
  skillOptions: Array<{ value: string; label: string }>;
  
  // API Configuration
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  hasSavedSecret: boolean;
  
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  
  // Actions
  onSave: () => Promise<void>;
  isSaving: boolean;
  
  // Preferences
  autoApprove: boolean;
  onAutoApproveChange: (value: boolean) => void;
  showTechnicalDetails: boolean;
  onShowTechnicalDetailsChange: (value: boolean) => void;
  verboseLogging: boolean;
  onVerboseLoggingChange: (value: boolean) => void;
}

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
  const matteSelectClass =
    "w-full [&_button]:!h-11 [&_button]:!rounded-xl [&_button]:!border-[var(--border)] [&_button]:!bg-[var(--surface)] [&_button]:!text-[var(--text-main)] [&_button]:hover:!bg-[var(--surface-strong)]";

  React.useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  React.useEffect(() => {
    setLocalBaseUrl(baseUrl);
  }, [baseUrl]);

  const handleSave = async () => {
    onApiKeyChange(localApiKey);
    onBaseUrlChange(localBaseUrl);
    await onSave();
  };
  const handleRequestClose = React.useCallback(() => {
    if (onRequestClose) onRequestClose();
    else onClose();
  }, [onClose, onRequestClose]);

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

      {presentation === 'overlay' ? (
        <div
          className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'animate-[fade-in_0.3s_ease-out]' : 'opacity-0 pointer-events-none'
          }`}
          onClick={handleRequestClose}
          aria-hidden="true"
        />
      ) : null}

      {/* Drawer */}
      <aside
        className={`flex h-full flex-col overflow-hidden bg-[var(--sidebar-bg)] ${
          presentation === 'overlay'
            ? `fixed right-0 top-0 z-50 w-full max-w-md border-l border-[var(--border)] transition-transform duration-300 ease-out ${
                isOpen ? 'animate-[slide-in-right_0.3s_ease-out]' : 'pointer-events-none translate-x-full'
              } shadow-[0_18px_56px_rgba(0,0,0,0.3)]`
            : `relative z-[60] order-last max-w-[92vw] transition-[width,opacity] duration-200 ${
                isOpen
                  ? 'w-[300px] border-l border-[var(--border)] opacity-100'
                  : 'pointer-events-none w-0 border-transparent opacity-0'
              }`
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
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
            {/* AI Provider Section */}
            <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-sub)]">Inference Engine</p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">
                    Provider
                  </label>
                  <Select
                    value={provider}
                    onChange={(value) => onProviderChange(value)}
                    options={providerOptions}
                    className={matteSelectClass}
                    searchable={false}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">
                    Model
                  </label>
                  <Select
                    value={model}
                    onChange={(value) => onModelChange(value)}
                    options={modelOptions}
                    disabled={loadingModels}
                    className={matteSelectClass}
                    searchable={false}
                  />
                  {loadingModels && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
                      <span className="text-xs font-medium text-[var(--text-sub)]">Loading models</span>
                    </div>
                  )}
                  {modelsError && (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{modelsError}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">
                    Role / Skill
                  </label>
                  <Select
                    value={skillId}
                    onChange={(value) => onSkillIdChange(value)}
                    options={skillOptions}
                    className={matteSelectClass}
                    searchable={false}
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-sub)]">
                    Select the AI role for specialized responses
                  </p>
                </div>
              </div>
            </section>

            {/* Connection Section */}
            <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <FrameworkIcons.Key size={16} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Connection
                </h3>
              </div>
              <div className="space-y-4">
                {providerNeedsApiKey ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-sub)]">
                      API Key {hasSavedSecret && '(encrypted)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={localApiKey}
                        onChange={(e) => {
                          setLocalApiKey(e.target.value);
                          onApiKeyChange(e.target.value);
                        }}
                        placeholder={hasSavedSecret ? '••••••••••••••••' : apiKeyPlaceholder}
                      className={`${GlassMorphism.GLASS_INPUT} w-full pr-10 text-sm`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-sub)] hover:text-[var(--text-main)]"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? (
                          <FrameworkIcons.Lock size={16} />
                        ) : (
                          <FrameworkIcons.Eye size={16} />
                        )}
                      </button>
                    </div>
                    {hasSavedSecret && !localApiKey && (
                      <p className="mt-1.5 text-xs text-[var(--text-sub)]">
                        Leave empty to keep existing key
                      </p>
                    )}
                  </div>
                ) : null}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-sub)]">
                    Base URL (optional)
                  </label>
                  <input
                    type="url"
                    value={localBaseUrl}
                    onChange={(e) => {
                      setLocalBaseUrl(e.target.value);
                      onBaseUrlChange(e.target.value);
                    }}
                    placeholder={baseUrlPlaceholder}
                    className={`${GlassMorphism.GLASS_INPUT} w-full text-sm`}
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-sub)]">
                    Override provider endpoint when needed
                  </p>
                </div>
              </div>
            </section>

            {/* Behavior Preferences Section */}
            <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--text-main)]">Developer Mode</span>
                    <span className="text-[10px] text-[var(--text-sub)]">Show traces and tool payloads</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showTechnicalDetails}
                    onClick={() => onShowTechnicalDetailsChange(!showTechnicalDetails)}
                    className={`relative h-5 w-9 rounded-full border transition ${
                      showTechnicalDetails
                        ? 'border-[var(--text-main)] bg-[var(--text-main)]'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] h-3.5 w-3.5 rounded-full transition ${
                        showTechnicalDetails ? 'left-[18px] bg-[var(--bg)]' : 'left-[2px] bg-[var(--text-main)]'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-sub)]">Capabilities</label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => onAutoApproveChange(e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-black ${
                        autoApprove
                          ? 'border-[var(--text-main)] bg-[var(--text-main)] text-[var(--bg)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-sm text-[var(--text-main)]">Auto Approve Safe Changes</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={verboseLogging}
                      onChange={(e) => onVerboseLoggingChange(e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-black ${
                        verboseLogging
                          ? 'border-[var(--text-main)] bg-[var(--text-main)] text-[var(--bg)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-sm text-[var(--text-main)]">Verbose Logging</span>
                  </label>
                </div>
              </div>
            </section>
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
              type="button"
              onClick={handleSave}
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
      </aside>
    </>
  );
}
