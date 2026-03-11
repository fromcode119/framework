'use client';

import React from 'react';
import { GlassMorphism } from '../ui/glass-morphism';
import { AssistantIntentUtils } from '../assistant-intent-utils';
import { AssistantTextUtils } from '../assistant-text-utils';
import type { AssistantMessageContentProps } from './assistant-conversation.interfaces';

export function AssistantMessageContent({ entry, messageIndex }: AssistantMessageContentProps) {
  if (AssistantIntentUtils.shouldHideAssistantBody(entry)) {
    return null;
  }

  return (
    <div className="space-y-2">
      {AssistantTextUtils.splitMessageBlocks(entry.content).map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <div key={`code-${blockIndex}`} className={`${GlassMorphism.GLASS_SUB_PANEL} overflow-hidden`}>
              <div className="border-b border-white/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/12 dark:text-slate-400">
                {block.language || 'code'}
              </div>
              <pre className="max-h-72 overflow-auto px-3 py-2 text-[12px] leading-relaxed text-slate-800 dark:text-slate-100">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        return <div key={`text-${messageIndex}-${blockIndex}`}>{AssistantTextUtils.renderText(block.content, `${messageIndex}-${blockIndex}`)}</div>;
      })}
    </div>
  );
}
