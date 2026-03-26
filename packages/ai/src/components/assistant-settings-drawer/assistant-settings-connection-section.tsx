'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../../ui/glass-morphism';

interface AssistantSettingsConnectionSectionProps {
  providerNeedsApiKey: boolean;
  hasSavedSecret: boolean;
  apiKeyPlaceholder: string;
  baseUrlPlaceholder: string;
  localApiKey: string;
  localBaseUrl: string;
  showApiKey: boolean;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onToggleApiKeyVisibility: () => void;
}

export function AssistantSettingsConnectionSection({
  providerNeedsApiKey,
  hasSavedSecret,
  apiKeyPlaceholder,
  baseUrlPlaceholder,
  localApiKey,
  localBaseUrl,
  showApiKey,
  onApiKeyChange,
  onBaseUrlChange,
  onToggleApiKeyVisibility,
}: AssistantSettingsConnectionSectionProps) {
  return (
    <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <FrameworkIcons.Key size={16} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connection</h3>
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
                onChange={(event) => onApiKeyChange(event.target.value)}
                placeholder={hasSavedSecret ? '••••••••••••••••' : apiKeyPlaceholder}
                className={`${GlassMorphism.GLASS_INPUT} w-full pr-10 text-sm`}
              />
              <button
                type="button"
                onClick={onToggleApiKeyVisibility}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-sub)] hover:text-[var(--text-main)]"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <FrameworkIcons.Lock size={16} /> : <FrameworkIcons.Eye size={16} />}
              </button>
            </div>
            {hasSavedSecret && !localApiKey ? (
              <p className="mt-1.5 text-xs text-[var(--text-sub)]">Leave empty to keep existing key</p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-sub)]">Base URL (optional)</label>
          <input
            type="url"
            value={localBaseUrl}
            onChange={(event) => onBaseUrlChange(event.target.value)}
            placeholder={baseUrlPlaceholder}
            className={`${GlassMorphism.GLASS_INPUT} w-full text-sm`}
          />
          <p className="mt-1.5 text-xs text-[var(--text-sub)]">Override provider endpoint when needed</p>
        </div>
      </div>
    </section>
  );
}
