'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import type { AssistantToolOption } from '../admin-assistant-core';

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
      className="fixed z-[120] overflow-hidden rounded-xl border border-white/58 bg-white/74 shadow-[0_20px_45px_rgba(2,6,23,0.24)] backdrop-blur-2xl dark:border-white/12 dark:bg-slate-900/72"
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
