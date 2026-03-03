'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GLASS_CARD, GLASS_PANEL, GLASS_BUTTON } from '../ui/glass-morphism';
import {
  AssistantMessage,
  splitMessageBlocks,
  renderInlineFormat,
  formatExecutionTitle,
  formatExecutionDetail,
} from '../assistant-utils';

function renderText(content: string, keyPrefix: string): React.ReactNode {
  const lines = String(content || '').split('\n');
  const blocks: React.ReactNode[] = [];
  let bulletItems: string[] = [];
  let orderedItems: string[] = [];

  const flushLists = () => {
    if (bulletItems.length > 0) {
      blocks.push(
        <ul key={`${keyPrefix}-bullet-${blocks.length}`} className="my-3 space-y-1.5 pl-5">
          {bulletItems.map((item, i) => (
            <li key={i} className="list-disc leading-relaxed text-slate-700 dark:text-slate-300">
              {renderInlineFormat(item, `bullet-${i}`)}
            </li>
          ))}
        </ul>,
      );
      bulletItems = [];
    }
    if (orderedItems.length > 0) {
      blocks.push(
        <ol key={`${keyPrefix}-ordered-${blocks.length}`} className="my-3 space-y-1.5 pl-5">
          {orderedItems.map((item, i) => (
            <li key={i} className="list-decimal leading-relaxed text-slate-700 dark:text-slate-300">
              {renderInlineFormat(item, `ordered-${i}`)}
            </li>
          ))}
        </ol>,
      );
      orderedItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushLists();
      blocks.push(<div key={`${keyPrefix}-br-${idx}`} className="h-2" />);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      bulletItems.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      orderedItems.push(orderedMatch[1]);
      return;
    }

    flushLists();
    blocks.push(
      <p key={`${keyPrefix}-p-${idx}`} className="leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInlineFormat(trimmed, `p-${idx}`)}
      </p>,
    );
  });

  flushLists();
  return blocks;
}

export function AssistantMessage({
  message,
  isLast,
  executing,
  runActions,
  selectedActionIndexes,
  setSelectedActionIndexes,
}: {
  message: AssistantMessage;
  isLast: boolean;
  executing: boolean;
  runActions: (options?: { dryRun?: boolean }) => Promise<void>;
  selectedActionIndexes: number[];
  setSelectedActionIndexes: (idxs: number[]) => void;
}) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  const blocks = splitMessageBlocks(message.content);

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser 
            ? 'bg-slate-900 text-white dark:bg-white/10' 
            : isSystem 
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
        }`}>
          {isUser ? <FrameworkIcons.User size={16} /> : <FrameworkIcons.Activity size={16} />}
        </div>
        
        <div className="flex flex-col gap-1">
          <div className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-slate-100 dark:bg-white/5' 
              : isSystem
              ? 'border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20'
              : 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10'
          }`}>
            {blocks.map((block, idx) => (
              <React.Fragment key={idx}>
                {block.type === 'text' && renderText(block.content, `msg-${idx}`)}
                {block.type === 'code' && (
                  <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
                    <div className="flex items-center justify-between bg-slate-100 px-4 py-1.5 dark:bg-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{block.language || 'code'}</span>
                    </div>
                    <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                      <code>{block.content}</code>
                    </pre>
                  </div>
                )}
              </React.Fragment>
            ))}

            {message.actions && message.actions.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
                  <span className="text-xs font-semibold text-slate-500">Proposed Actions</span>
                  {isLast && !executing && (
                    <button
                      onClick={() => runActions({ dryRun: false })}
                      className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-bold text-white hover:bg-sky-700"
                    >
                      Execute Selected
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {message.actions.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-br from-white/95 to-slate-50/80 p-3 backdrop-blur-sm dark:border-slate-700/60 dark:from-slate-900/80 dark:to-slate-800/60">
                      <div className="relative mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedActionIndexes.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedActionIndexes([...selectedActionIndexes, idx]);
                            else setSelectedActionIndexes(selectedActionIndexes.filter(i => i !== idx));
                          }}
                          className="peer sr-only"
                        />
                        <div className="h-4 w-4 rounded border-2 border-slate-300 bg-white transition peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-focus:ring-2 peer-focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-400" />
                        <FrameworkIcons.Check 
                          size={10} 
                          className="pointer-events-none absolute text-white opacity-0 transition peer-checked:opacity-100" 
                          strokeWidth={3}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{formatExecutionTitle(action)}</div>
                        <div className="text-[11px] text-slate-500">{formatExecutionDetail(action)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {message.timestamp && (
            <span className="px-2 text-[10px] text-slate-400">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
