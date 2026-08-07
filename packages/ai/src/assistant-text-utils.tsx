import { AssistantRole } from '@ai/enums/assistant-role.enum';
import type { ReactNode } from 'react';
import type { IUploadedAttachment } from '@ai/interfaces/uploaded-attachment.interface';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import { MessageBlock } from '@ai/message-block';

/**
 * Static renderer/util for assistant message text — splits fenced code blocks, formats inline `code`/**bold**,
 * and renders bullet/ordered/key-value lines to React nodes via JSX (no raw React.createElement).
 */
export class AssistantTextUtils {
  static normalizeBodyText(content: string): string { return AssistantTextUtils.normalizeAssistantBodyText(content); }

  static splitMessageBlocks(content: string): MessageBlock[] {
    const source = String(content || '');
    if (!source.trim()) return [MessageBlock.text(source)];

    const blocks: MessageBlock[] = [];
    const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    let cursor = 0;

    for (const match of source.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > cursor) {
        blocks.push(MessageBlock.text(source.slice(cursor, start)));
      }
      blocks.push(MessageBlock.code(
        String(match[2] || '').replace(/\n$/, ''),
        String(match[1] || '').trim(),
      ));
      cursor = end;
    }

    if (cursor < source.length) {
      blocks.push(MessageBlock.text(source.slice(cursor)));
    }
    return blocks;
  }

  static renderInlineFormat(text: string, keyPrefix: string): ReactNode[] {
    const source = String(text || '');
    if (!source) return [''];

    const nodes: ReactNode[] = [];
    const pattern = /(`[^`\n]+`|\*\*.+?\*\*)/g;
    let cursor = 0;

    for (const match of source.matchAll(pattern)) {
      const start = match.index;
      const token = match[0];
      if (start > cursor) nodes.push(source.slice(cursor, start));

      if (token.startsWith('`') && token.endsWith('`')) {
        nodes.push(
          <code
            key={`${keyPrefix}-code-${start}`}
            className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
          >
            {token.slice(1, -1)}
          </code>,
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        nodes.push(
          <strong key={`${keyPrefix}-strong-${start}`} className="font-bold">
            {token.slice(2, -2)}
          </strong>,
        );
      } else {
        nodes.push(token);
      }
      cursor = start + token.length;
    }

    if (cursor < source.length) nodes.push(source.slice(cursor));
    return nodes;
  }

  private static normalizeLine(line: string): string {
    const text = String(line || '').trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1).trim();
    }
    return text;
  }

  private static renderKeyValueLine(line: string, lineKey: string): ReactNode {
    const normalized = AssistantTextUtils.normalizeLine(line);
    const keyValue = normalized.match(/^([A-Za-z0-9_.-]+):(.*)$/);
    if (!keyValue) return AssistantTextUtils.renderInlineFormat(normalized, lineKey);
    const key = keyValue[1];
    const rest = keyValue[2] || '';
    return (
      <>
        <strong>{`${key}:`}</strong>
        {rest ? <>{' '}{AssistantTextUtils.renderInlineFormat(rest.trim(), `${lineKey}-rest`)}</> : null}
      </>
    );
  }

  static renderText(content: string, keyPrefix: string): ReactNode {
    const lines = String(content || '').split('\n');
    const blocks: ReactNode[] = [];
    const bulletItems: string[] = [];
    const orderedItems: string[] = [];

    const flushBulletItems = (): void => {
      if (!bulletItems.length) return;
      const startIndex = blocks.length;
      const items = [...bulletItems];
      blocks.push(
        <ul key={`${keyPrefix}-ul-${startIndex}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-item-${itemIndex}`} className="whitespace-pre-wrap break-words leading-relaxed">
              {AssistantTextUtils.renderKeyValueLine(item, `${keyPrefix}-ul-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      bulletItems.length = 0;
    };

    const flushOrderedItems = (): void => {
      if (!orderedItems.length) return;
      const startIndex = blocks.length;
      const items = [...orderedItems];
      blocks.push(
        <ol key={`${keyPrefix}-ol-${startIndex}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-item-${itemIndex}`} className="whitespace-pre-wrap break-words leading-relaxed">
              {AssistantTextUtils.renderKeyValueLine(item, `${keyPrefix}-ol-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      orderedItems.length = 0;
    };

    lines.forEach((line, index) => {
      const trimmed = AssistantTextUtils.normalizeLine(line);
      const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
      const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (bulletMatch) {
        flushOrderedItems();
        bulletItems.push(bulletMatch[1]);
        return;
      }
      if (orderedMatch) {
        flushBulletItems();
        orderedItems.push(orderedMatch[1]);
        return;
      }
      flushBulletItems();
      flushOrderedItems();
      if (!trimmed) {
        blocks.push(<div key={`${keyPrefix}-gap-${index}`} className="h-1" />);
        return;
      }
      blocks.push(
        <p key={`${keyPrefix}-line-${index}`} className="whitespace-pre-wrap break-words leading-relaxed">
          {AssistantTextUtils.renderKeyValueLine(trimmed, `${keyPrefix}-${index}`)}
        </p>,
      );
    });

    flushBulletItems();
    flushOrderedItems();

    return <div className="space-y-1.5">{blocks}</div>;
  }

  static serializeAttachmentsForModel(attachments: IUploadedAttachment[]): string {
    if (!attachments.length) return '';
    const lines = attachments.map((item, index) => {
      const parts = [
        `name=${item.name}`,
        item.url ? `url=${item.url}` : '',
        item.path ? `path=${item.path}` : '',
        item.mimeType ? `mime=${item.mimeType}` : '',
        item.size ? `size=${item.size}` : '',
        item.width && item.height ? `dimensions=${item.width}x${item.height}` : '',
      ].filter(Boolean);
      return `${index + 1}. ${parts.join('; ')}`;
    });
    return `Attached assets (uploaded by user):\n${lines.join('\n')}`;
  }

  static stripReadyMessage(entries: IAssistantMessage[]): IAssistantMessage[] {
    return entries.filter((entry, index) => {
      if (
        index === 0 &&
        entry.role === AssistantRole.SYSTEM &&
        String(entry.content || '').toLowerCase().includes('ready')
      ) {
        return false;
      }
      return true;
    });
  }

  static summarizeSessionTitle(entries: IAssistantMessage[]): string {
    const firstUser = entries.find((entry) => entry.role === AssistantRole.USER && String(entry.content || '').trim());
    if (!firstUser) return 'Untitled session';
    const text = String(firstUser.content || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Untitled session';
    return text.length > 64 ? `${text.slice(0, 63)}...` : text;
  }

  static normalizeAssistantBodyText(content: string): string {
    const text = String(content || '').trim();
    if (!text) return '';

    if (/^\{[\s\S]*\}$/.test(text)) {
      try {
        const parsed = JSON.parse(text);
        const parsedMessage = String(parsed?.message || '').trim();
        if (parsedMessage) return parsedMessage;
        if (Array.isArray(parsed?.actions) && parsed.actions.length > 0) {
          return `I prepared ${parsed.actions.length} change${parsed.actions.length > 1 ? 's' : ''} for review.`;
        }
      } catch {
        // fall through to plain sanitization
      }
    }

    const cleaned = text
      .split('\n')
      .filter((line) => {
        const normalized = String(line || '').trim().toLowerCase();
        if (!normalized) return true;
        if (
          normalized.startsWith('plan goal:') ||
          normalized.startsWith('goal:') ||
          normalized.startsWith('exact search:') ||
          normalized.startsWith('staged:') ||
          normalized.startsWith('next: run preview') ||
          normalized.startsWith('technical details') ||
          normalized.startsWith('plan • ')
        ) {
          return false;
        }
        return true;
      })
      .join('\n')
      .trim();

    return cleaned;
  }
}
