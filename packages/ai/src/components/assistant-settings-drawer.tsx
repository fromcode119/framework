'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '../ui/select';
import { GLASS_CARD, GLASS_INPUT, GLASS_BUTTON } from '../ui/glass-morphism';

interface AssistantSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  
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

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-md transition-opacity duration-300 ${
          isOpen ? 'animate-[fade-in_0.3s_ease-out]' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-200/80 bg-white/95 shadow-[0_0_80px_rgba(2,6,23,0.3)] backdrop-blur-xl transition-transform duration-300 ease-out dark:border-slate-700/70 dark:bg-slate-900/95 dark:shadow-[0_0_80px_rgba(2,6,23,0.6)] ${
          isOpen ? 'animate-[slide-in-right_0.3s_ease-out]' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <FrameworkIcons.Settings size={20} />
            </div>
            <div>
              <h2 id="settings-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure AI provider and preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close settings"
          >
            <FrameworkIcons.X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {/* AI Provider Section */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <FrameworkIcons.Activity size={16} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Provider</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Provider
                  </label>
                  <Select
                    value={provider}
                    onChange={(value) => onProviderChange(value)}
                    options={providerOptions}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Model
                  </label>
                  <Select
                    value={model}
                    onChange={(value) => onModelChange(value)}
                    options={modelOptions}
                    disabled={loadingModels}
                    className="w-full"
                  />
                  {loadingModels && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-cyan-50/50 px-2.5 py-1.5 dark:bg-cyan-900/20">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600 dark:border-cyan-800 dark:border-t-cyan-400" />
                      <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">Loading models</span>
                    </div>
                  )}
                  {modelsError && (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{modelsError}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Role / Skill
                  </label>
                  <Select
                    value={skillId}
                    onChange={(value) => onSkillIdChange(value)}
                    options={skillOptions}
                    className="w-full"
                  />
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Select the AI role for specialized responses
                  </p>
                </div>
              </div>
            </section>

            {/* API Configuration Section */}
            {provider === 'openai' && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <FrameworkIcons.Key size={16} className="text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    API Configuration
                  </h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      API Key {hasSavedSecret && '(encrypted)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        placeholder={hasSavedSecret ? '••••••••••••••••' : 'sk-...'}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        Leave empty to keep existing key
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Base URL (optional)
                    </label>
                    <input
                      type="url"
                      value={localBaseUrl}
                      onChange={(e) => setLocalBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                    />
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      For OpenAI-compatible endpoints
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Behavior Preferences Section */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <FrameworkIcons.Settings size={16} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Behavior</h3>
              </div>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 group">
                  <div className="relative mt-0.5 flex h-4 w-4 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => onAutoApproveChange(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-4 w-4 rounded border-2 border-slate-300 bg-white/60 shadow-sm backdrop-blur-sm transition peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-checked:shadow-md peer-focus:ring-2 peer-focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800/60 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-400" />
                    <FrameworkIcons.Check 
                      size={12} 
                      className="pointer-events-none absolute text-white opacity-0 transition peer-checked:opacity-100" 
                      strokeWidth={3}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Auto-approve safe changes
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Automatically apply low-risk updates without confirmation
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 group">
                  <div className="relative mt-0.5 flex h-4 w-4 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={showTechnicalDetails}
                      onChange={(e) => onShowTechnicalDetailsChange(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-4 w-4 rounded border-2 border-slate-300 bg-white/60 shadow-sm backdrop-blur-sm transition peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-checked:shadow-md peer-focus:ring-2 peer-focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800/60 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-400" />
                    <FrameworkIcons.Check 
                      size={12} 
                      className="pointer-events-none absolute text-white opacity-0 transition peer-checked:opacity-100" 
                      strokeWidth={3}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Show technical details
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Display tool calls, traces, and debug information
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 group">
                  <div className="relative mt-0.5 flex h-4 w-4 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={verboseLogging}
                      onChange={(e) => onVerboseLoggingChange(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-4 w-4 rounded border-2 border-slate-300 bg-white/60 shadow-sm backdrop-blur-sm transition peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-checked:shadow-md peer-focus:ring-2 peer-focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800/60 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-400" />
                    <FrameworkIcons.Check 
                      size={12} 
                      className="pointer-events-none absolute text-white opacity-0 transition peer-checked:opacity-100" 
                      strokeWidth={3}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Verbose logging
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Log detailed AI interactions to browser console
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(6,182,212,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(6,182,212,0.5)] disabled:cursor-not-allowed disabled:opacity-60 dark:from-cyan-500 dark:to-sky-500"
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
