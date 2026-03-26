'use client';

import React from 'react';
import { GlassMorphism } from '../../ui/glass-morphism';

interface AssistantSettingsPreferencesSectionProps {
  autoApprove: boolean;
  onAutoApproveChange: (value: boolean) => void;
  showTechnicalDetails: boolean;
  onShowTechnicalDetailsChange: (value: boolean) => void;
  verboseLogging: boolean;
  onVerboseLoggingChange: (value: boolean) => void;
}

export function AssistantSettingsPreferencesSection({
  autoApprove,
  onAutoApproveChange,
  showTechnicalDetails,
  onShowTechnicalDetailsChange,
  verboseLogging,
  onVerboseLoggingChange,
}: AssistantSettingsPreferencesSectionProps) {
  return (
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
          <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-sub)]">
            Capabilities
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(event) => onAutoApproveChange(event.target.checked)}
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
              onChange={(event) => onVerboseLoggingChange(event.target.checked)}
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
  );
}
