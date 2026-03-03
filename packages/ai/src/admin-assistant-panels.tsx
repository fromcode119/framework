'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from './ui/select';
import type { AssistantToolOption, ForgeHistorySession } from './admin-assistant-core';

type HistoryPanelProps = {
  showHistory: boolean;
  historySource: 'server' | 'local';
  historyLoading: boolean;
  historySessions: ForgeHistorySession[];
  activeSessionId: string;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  startNewSession: () => void;
  openHistorySession: (sessionId: string) => Promise<void>;
  removeHistorySession: (sessionId: string) => void;
};

export function HistoryPanel({
  showHistory,
  historySource,
  historyLoading,
  historySessions,
  activeSessionId,
  setShowHistory,
  startNewSession,
  openHistorySession,
  removeHistorySession,
}: HistoryPanelProps) {
  return (
    <aside
      className={`relative z-[60] order-first flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-white/96 dark:bg-[#0a1120]/96 ${
        showHistory
          ? 'w-[360px] max-w-[92vw] border-slate-200/80 dark:border-white/10'
          : 'pointer-events-none w-0 border-transparent'
      }`}
    >
      <div className={`flex h-full w-[360px] flex-col p-4 transition-opacity duration-300 ${
        showHistory ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">History</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Recent chats and reusable runs {historySource === 'server' ? '(server)' : '(local fallback)'}.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={startNewSession}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:border-white/25"
          >
            <FrameworkIcons.Plus size={12} />
            New
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:bg-black/20 dark:text-slate-300 dark:hover:text-white"
            aria-label="Close history"
          >
            <FrameworkIcons.X size={14} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {historyLoading ? (
          <div className="group rounded-xl border border-slate-200/70 bg-gradient-to-br from-white/95 to-slate-50/95 px-3 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:from-slate-900/80 dark:to-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600 dark:border-cyan-800 dark:border-t-cyan-400" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Loading history</span>
            </div>
          </div>
        ) : historySessions.length === 0 ? (
          <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white/95 to-slate-50/95 px-3 py-3 backdrop-blur-sm dark:border-slate-700/60 dark:from-slate-900/80 dark:to-slate-800/80">
            <p className="text-xs text-slate-500 dark:text-slate-400">No saved chats yet.</p>
          </div>
        ) : (
          historySessions.map((session) => {
            const active = session.id === activeSessionId;
            const time = new Date(session.updatedAt || Date.now()).toLocaleString();
            return (
              <div
                key={session.id}
                className={`w-full rounded-xl border px-2.5 py-2 transition ${
                  active
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-300/60 dark:bg-cyan-300/12 dark:text-cyan-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openHistorySession(session.id)}
                  className="w-full text-left"
                >
                  <p className="line-clamp-2 text-xs font-semibold">{session.title}</p>
                  <p className="mt-1 text-[10px] opacity-75">
                    {session.provider} • {session.model || 'default'} • {session.messageCount || session.messages.length || 0} msgs • {time}
                  </p>
                </button>
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeHistorySession(session.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <FrameworkIcons.Trash size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </aside>
  );
}

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
  return (
    <aside
      className={`relative z-[60] order-last flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-white/96 transition-none dark:bg-[#0a1120]/96 ${
        showGateway
          ? 'w-[360px] max-w-[92vw] border-slate-200/80 p-4 opacity-100 dark:border-white/10'
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:bg-black/20 dark:text-slate-300 dark:hover:text-white"
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

        {provider === 'openai' ? (
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
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
          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Base URL (optional)</label>
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
          className="h-11 w-full rounded-xl bg-cyan-500 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
        >
          {integrationSaving ? 'Saving...' : 'Save Gateway'}
        </button>
        <button
          type="button"
          onClick={openAdvancedAiSettings}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-black/20 dark:text-slate-100 dark:hover:border-white/25"
        >
          Open Advanced Integration
        </button>
      </form>
    </aside>
  );
}

type ToolsOverlayProps = {
  showTools: boolean;
  toolsMenuStyle: { left: number; top: number; width: number } | null;
  toolsDropdownRef: React.RefObject<HTMLDivElement | null>;
  availableTools: AssistantToolOption[];
  selectedTools: string[];
  setSelectedTools: React.Dispatch<React.SetStateAction<string[]>>;
  toggleTool: (toolName: string) => void;
  getToolHelp: (toolName: string, providedDescription?: string) => string;
};

export function ToolsOverlay({
  showTools,
  toolsMenuStyle,
  toolsDropdownRef,
  availableTools,
  selectedTools,
  setSelectedTools,
  toggleTool,
  getToolHelp,
}: ToolsOverlayProps) {
  if (!showTools || !toolsMenuStyle || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={toolsDropdownRef}
      style={{ left: toolsMenuStyle.left, top: toolsMenuStyle.top, width: toolsMenuStyle.width }}
      className="fixed z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Tool Permissions</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSelectedTools(availableTools.map((tool) => tool.tool))}
              className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedTools([])}
              className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            >
              None
            </button>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Choose what Forge is allowed to use in this chat.</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {availableTools.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-slate-500 dark:text-slate-400">No tools available.</p>
        ) : (
          availableTools.map((tool) => {
            const checked = selectedTools.includes(tool.tool);
            const help = getToolHelp(tool.tool, tool.description);
            return (
              <button
                key={tool.tool}
                type="button"
                onClick={() => toggleTool(tool.tool)}
                className={`mb-1 w-full rounded-lg border px-2 py-1.5 text-left transition last:mb-0 ${
                  checked
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-300/50 dark:bg-indigo-300/14 dark:text-indigo-100'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">{tool.tool}</span>
                  {tool.readOnly ? (
                    <span className="rounded-full border border-slate-300 px-1.5 py-0.5 text-[9px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                      read
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-300 px-1.5 py-0.5 text-[9px] text-amber-700 dark:border-amber-300/50 dark:text-amber-200">
                      write
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">{help}</p>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}
