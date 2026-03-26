'use client';

import React from 'react';
import { Select } from '../../ui/select';
import { GlassMorphism } from '../../ui/glass-morphism';

interface AssistantSettingsProviderSectionProps {
  provider: string;
  onProviderChange: (provider: string) => void;
  providerOptions: Array<{ value: string; label: string }>;
  model: string;
  onModelChange: (model: string) => void;
  modelOptions: Array<{ value: string; label: string }>;
  loadingModels: boolean;
  modelsError: string;
  skillId: string;
  onSkillIdChange: (skillId: string) => void;
  skillOptions: Array<{ value: string; label: string }>;
}

export function AssistantSettingsProviderSection({
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
}: AssistantSettingsProviderSectionProps) {
  const matteSelectClass =
    "w-full [&_button]:!h-11 [&_button]:!rounded-xl [&_button]:!border-[var(--border)] [&_button]:!bg-[var(--surface)] [&_button]:!text-[var(--text-main)] [&_button]:hover:!bg-[var(--surface-strong)]";

  return (
    <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-sub)]">
        Inference Engine
      </p>
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
          {loadingModels ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
              <span className="text-xs font-medium text-[var(--text-sub)]">Loading models</span>
            </div>
          ) : null}
          {modelsError ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{modelsError}</p> : null}
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
          <p className="mt-1.5 text-xs text-[var(--text-sub)]">Select the AI role for specialized responses</p>
        </div>
      </div>
    </section>
  );
}
