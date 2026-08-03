import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, Ref } from '@fromcode119/reactor';
import { AssistantLoadingState } from '@ai/components/assistant-loading-state';
import { AssistantConversationEmptyState } from '@ai/components/assistant-conversation-empty-state';
import { AssistantConversationMessage } from '@ai/components/assistant-conversation-message';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';

export class AssistantConversation extends PureReactor {
  @prop declare viewportRef: Ref<HTMLDivElement>;
  @prop declare viewportBottomPadding: number;
  @prop declare hasConversation: boolean;
  @prop declare visibleMessages: IAssistantMessage[];
  @prop declare forkFromVisibleMessage: (index: number) => void;
  @prop declare setChatMode: Dispatch<SetStateAction<ChatMode>>;
  @prop declare loading: boolean;
  @prop declare scrollAnchorRef: Ref<HTMLDivElement>;
  @prop declare chatMode: ChatMode;
  @prop declare loadingPhaseIndex: number;
  @prop declare showTechnicalDetails: boolean;

  private get conversationMode(): ConversationMode {
    return this.chatMode === ChatMode.PLAN ? ConversationMode.BUILD : this.chatMode === ChatMode.AGENT ? ConversationMode.QUICKFIX : ConversationMode.CHAT;
  }

  private renderMessage(entry: IAssistantMessage, index: number): ReactNode {
    return (
      <AssistantConversationMessage
        key={`${entry.role}-${index}`}
        entry={entry}
        index={index}
        forkFromVisibleMessage={this.forkFromVisibleMessage}
        setChatMode={this.setChatMode}
        showTechnicalDetails={this.showTechnicalDetails}
      />
    );
  }

  render(): ReactNode {
    return (
      <div ref={this.viewportRef} className="h-full scroll-smooth overflow-y-auto px-4 pt-5 sm:px-8" style={{ paddingBottom: `${this.viewportBottomPadding}px` }}>
        {!this.hasConversation ? (
          <AssistantConversationEmptyState />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 pb-8">
            {this.visibleMessages.map((entry, index) => this.renderMessage(entry, index))}
            {this.loading ? <AssistantLoadingState mode={this.conversationMode} phase={this.loadingPhaseIndex} /> : null}
            <div ref={this.scrollAnchorRef} className="h-0" />
          </div>
        )}
      </div>
    );
  }
}
