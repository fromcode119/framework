'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GLASS_CARD, GLASS_BUTTON, GLASS_BUTTON_PRIMARY } from '../ui/glass-morphism';
import type { AssistantAction } from '../admin-assistant-core';

interface AssistantActionCardProps {
  actions: AssistantAction[];
  selectedIndexes: number[];
  onToggleAction: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPreview: () => void;
  onApply: () => Promise<void>;
  onCancel: () => void;
  isApplying: boolean;
  canPreview?: boolean;
}

export function AssistantActionCard({
  actions,
  selectedIndexes,
  onToggleAction,
  onSelectAll,
  onDeselectAll,
  onPreview,
  onApply,
  onCancel,
  isApplying,
  canPreview = true,
}: AssistantActionCardProps) {
  if (!actions || actions.length === 0) {
    return null;
  }

  const selectedCount = selectedIndexes.length;
  const allSelected = selectedCount === actions.length;
  const someSelected = selectedCount > 0 && selectedCount < actions.length;

  const formatActionLabel = (action: AssistantAction): string => {
    if (action.type === 'create_content') {
      return `Create ${action.collectionSlug || 'content'} record`;
    }
    if (action.type === 'update_setting') {
      return `Update ${action.key || 'setting'}`;
    }
    if (action.type === 'mcp_call') {
      return action.tool || 'Execute action';
    }
    return action.type || 'Unknown action';
  };

  const formatActionDetail = (action: AssistantAction): string | null => {
    if (action.reason) return action.reason;
    
    if (action.type === 'update_setting' && action.value !== undefined) {
      return `Set to: ${JSON.stringify(action.value)}`;
    }
    
    if (action.type === 'mcp_call' && action.input) {
      const keys = Object.keys(action.input);
      if (keys.length > 0) {
        const firstKey = keys[0];
        return `${firstKey}: ${JSON.stringify(action.input[firstKey])}`;
      }
    }
    
    return null;
  };

  return (
    <div className="sticky top-16 z-20 mx-4 mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/92 shadow-[0_16px_40px_rgba(2,6,23,0.18)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-[0_16px_40px_rgba(2,6,23,0.34)] sm:mx-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-cyan-50/90 to-sky-50/90 px-5 py-3.5 backdrop-blur-sm dark:border-slate-700/70 dark:from-cyan-950/40 dark:to-sky-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200/60 bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-[0_4px_14px_rgba(6,182,212,0.25)]">
            <FrameworkIcons.Wrench size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ready to Apply
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {selectedCount} of {actions.length} {actions.length === 1 ? 'change' : 'changes'} selected
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected || someSelected ? onDeselectAll : onSelectAll}
            className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            {allSelected || someSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Action List */}
      <div className="max-h-64 overflow-y-auto px-5 py-4">
        <div className="space-y-2.5">
          {actions.map((action, index) => {
            const isSelected = selectedIndexes.includes(index);
            const label = formatActionLabel(action);
            const detail = formatActionDetail(action);

            return (
              <label
                key={index}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                  isSelected
                    ? 'border-cyan-300/60 bg-cyan-50/50 backdrop-blur-sm dark:border-cyan-600/40 dark:bg-cyan-950/30'
                    : 'border-slate-200/80 bg-white/60 hover:border-slate-300/80 dark:border-slate-700/70 dark:bg-slate-900/40 dark:hover:border-slate-600/70'
                }`}
              >
                <div className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleAction(index)}
                    className="peer sr-only"
                  />
                  <div className="h-4 w-4 rounded border-2 border-slate-300 bg-white transition peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-focus:ring-2 peer-focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-400" />
                  <FrameworkIcons.Check 
                    size={10} 
                    className="pointer-events-none absolute text-white opacity-0 transition peer-checked:opacity-100" 
                    strokeWidth={3}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {label}
                    </span>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                      {action.type}
                    </span>
                  </div>
                  {detail && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {detail}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200/80 bg-slate-50/60 px-5 py-3.5 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs">
            <FrameworkIcons.Alert size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Changes will be applied immediately
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                You can undo from Activity History
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              Start Over
            </button>
            
            {canPreview && (
              <button
                type="button"
                onClick={onPreview}
                disabled={selectedCount === 0 || isApplying}
                className="rounded-lg border border-cyan-200/80 bg-cyan-50/80 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100/80 disabled:opacity-50 dark:border-cyan-800/60 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-950/60"
              >
                <FrameworkIcons.Eye size={14} className="inline mr-1.5" />
                Preview
              </button>
            )}
            
            <button
              type="button"
              onClick={onApply}
              disabled={selectedCount === 0 || isApplying}
              className="flex items-center gap-2 rounded-lg border border-cyan-200/60 bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_14px_rgba(6,182,212,0.25)] transition hover:from-cyan-600 hover:to-sky-700 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                    <FrameworkIcons.Loader size={20} className="animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <FrameworkIcons.Check size={14} />
                  Apply {selectedCount > 0 ? `(${selectedCount})` : 'All'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
