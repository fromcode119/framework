'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '../ui/select';
import { GLASS_CARD, GLASS_INPUT, GLASS_BUTTON, GLASS_BUTTON_PRIMARY } from '../ui/glass-morphism';
import { PROVIDER_OPTIONS } from '../assistant-utils';

export function AssistantGateway({
  showGateway,
  setShowGateway,
  provider,
  switchProvider,
  model,
  setModel,
  modelOptions,
  loadingProviderModels,
  providerModelsError,
  apiKey,
  setApiKey,
  hasSavedSecret,
  baseUrl,
  setBaseUrl,
  integrationSaving,
  saveIntegration,
  openAdvancedAiSettings,
}: {
  showGateway: boolean;
  setShowGateway: (val: boolean) => void;
  provider: string;
  switchProvider: (p: string) => void;
  model: string;
  setModel: (m: string) => void;
  modelOptions: { value: string; label: string }[];
  loadingProviderModels: boolean;
  providerModelsError: string;
  apiKey: string;
  setApiKey: (val: string) => void;
  hasSavedSecret: boolean;
  baseUrl: string;
  setBaseUrl: (val: string) => void;
  integrationSaving: boolean;
  saveIntegration: () => Promise<void>;
  openAdvancedAiSettings: () => void;
  chatMode: 'auto' | 'plan' | 'agent';
  setChatMode: (mode: 'auto' | 'plan' | 'agent') => void;
  sandboxMode: boolean;
  setSandboxMode: (val: boolean) => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-slate-200 bg-white/98 backdrop-blur-md transition-all duration-300 dark:border-slate-800 dark:bg-slate-950/98 sm:w-96 ${
        showGateway ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0'
      }`}
    >
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gateway Setup</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Provider, model, and connection profile.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowGateway(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300"
            aria-label="Close gateway settings"
          >
            <FrameworkIcons.X size={18} />
          </button>
        </div>
      </div>

      <form
        className="flex-1 overflow-y-auto p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void saveIntegration();
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">Provider</label>
          <Select value={provider} onChange={switchProvider} options={PROVIDER_OPTIONS} searchable={false} />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">Model</label>
          <Select value={model} onChange={setModel} options={modelOptions} />
          {loadingProviderModels && <p className="mt-1 text-[11px] text-slate-400">Loading models...</p>}
          {providerModelsError && <p className="mt-1 text-[11px] text-red-500">{providerModelsError}</p>}
          {!loadingProviderModels && !providerModelsError && modelOptions.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              No models available. {provider === 'ollama' ? 'Make sure Ollama is running and has models installed.' : 'Configure your API key and check your provider settings.'}
            </p>
          )}
        </div>

        {provider === 'openai' ? (
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">
              API Key {hasSavedSecret ? '(saved key exists)' : ''}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-black/20 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-300/65"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">Base URL (optional)</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-black/20 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-300/65"
          />
        </div>

        <button
          type="submit"
          disabled={integrationSaving}
          className="h-11 w-full rounded-xl bg-slate-900 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {integrationSaving ? 'Saving...' : 'Save Gateway'}
        </button>
        <button
          type="button"
          onClick={openAdvancedAiSettings}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Open Advanced Integration
        </button>
        </div>
      </form>
    </aside>
  );
}
