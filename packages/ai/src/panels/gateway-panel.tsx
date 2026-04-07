'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '../ui/select';
import { AssistantProviderUtils } from '../assistant-provider-utils';
import { GlassMorphism } from '../ui/glass-morphism';

type GatewayPanelProps = {
  showGateway: boolean;
  setShowGateway: React.Dispatch<React.SetStateAction<boolean>>;
  provider: string;
  switchProvider: (provider: string) => void;
  providerOptions: Array<{ value: string; label: string }>;
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  modelOptions: Array<{ value: string; label: string }>;
  loadingProviderModels: boolean;
  providerModelsError: string;
  hasSavedSecret: boolean;
  apiKey: string;
  setApiKey: React.Dispatch<React.SetStateAction<string>>;
  baseUrl: string;
  setBaseUrl: React.Dispatch<React.SetStateAction<string>>;
  integrationSaving: boolean;
  saveIntegration: () => Promise<void>;
  openAdvancedAiSettings: () => void;
};

export function GatewayPanel({
  showGateway,
  setShowGateway,
  provider,
  switchProvider,
  providerOptions,
  model,
  setModel,
  modelOptions,
  loadingProviderModels,
  providerModelsError,
  hasSavedSecret,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  integrationSaving,
  saveIntegration,
  openAdvancedAiSettings,
}: GatewayPanelProps) {
  const providerNeedsApiKey = AssistantProviderUtils.providerRequiresApiKey(provider);
  const baseUrlPlaceholder = AssistantProviderUtils.providerBaseUrlPlaceholder(provider);

  return (
    <aside
      className={`relative z-[60] order-last flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-white/50 bg-white/70 backdrop-blur-2xl transition-none dark:border-white/12 dark:bg-slate-900/40 ${
        showGateway
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
          onClick={() => setShowGateway(false)}
          className={GlassMorphism.GLASS_ICON_BUTTON}
          aria-label="Close gateway settings"
        >
          <FrameworkIcons.X size={14} />
        </button>
      </div>

      <form
        className="space-y-3 overflow-y-auto pr-1"
        onSubmit={(event) => {
          event.preventDefault();
          void saveIntegration();
        }}
      >
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Provider</label>
          <Select value={provider} onChange={switchProvider} options={providerOptions} searchable={false} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Model</label>
          <Select value={model} onChange={setModel} options={modelOptions} />
          {loadingProviderModels ? <p className="mt-1 text-[11px] text-slate-400">Loading models...</p> : null}
          {providerModelsError ? <p className="mt-1 text-[11px] text-amber-200">{providerModelsError}</p> : null}
        </div>

        {providerNeedsApiKey ? (
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              API Key {hasSavedSecret ? '(saved key exists)' : ''}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={AssistantProviderUtils.providerApiKeyPlaceholder(provider)}
              className="h-11 w-full rounded-xl border border-white/65 bg-white/72 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/12 dark:bg-slate-900/44 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400/65"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Base URL (optional)</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={baseUrlPlaceholder}
            className="h-11 w-full rounded-xl border border-white/65 bg-white/72 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-white/12 dark:bg-slate-900/44 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400/65"
          />
        </div>

        <button
          type="submit"
          disabled={integrationSaving}
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--text-main)] text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {integrationSaving ? 'Saving...' : 'Save Gateway'}
        </button>
        <button
          type="button"
          onClick={openAdvancedAiSettings}
          className={`${GlassMorphism.GLASS_BUTTON} h-11 w-full text-sm font-semibold`}
        >
          Open Advanced Integration
        </button>
      </form>
    </aside>
  );
}
