import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AssistantIntentUtils } from '@ai/assistant-intent-utils';
import { AssistantTextUtils } from '@ai/assistant-text-utils';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { MessageBlock } from '@ai/message-block';

export class AssistantMessageContent extends PureReactor {
  @prop declare entry: IAssistantMessage;
  @prop declare messageIndex: number;

  private renderBlock(block: MessageBlock, blockIndex: number): ReactNode {
    if (block.isCode) {
      return (
        <div key={`code-${blockIndex}`} className={`${GlassMorphism.GLASS_SUB_PANEL} overflow-hidden`}>
          <div className="border-b border-white/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/12 dark:text-slate-400">
            {block.languageLabel}
          </div>
          <pre className="max-h-72 overflow-auto px-3 py-2 text-[12px] leading-relaxed text-slate-800 dark:text-slate-100">
            <code>{block.content}</code>
          </pre>
        </div>
      );
    }

    return <div key={`text-${this.messageIndex}-${blockIndex}`}>{AssistantTextUtils.renderText(block.content, `${this.messageIndex}-${blockIndex}`)}</div>;
  }

  render(): ReactNode {
    if (AssistantIntentUtils.shouldHideAssistantBody(this.entry)) {
      return null;
    }

    return (
      <div className="space-y-2">
        {AssistantTextUtils.splitMessageBlocks(this.entry.content).map((block, blockIndex) => this.renderBlock(block, blockIndex))}
      </div>
    );
  }
}
