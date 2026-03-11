import React from 'react';
import type { AssistantMessage, UploadedAttachment, MessageBlock } from './assistant-core-constants.types';

export class AssistantTextUtils {
  static normalizeBodyText(content: string): string { return AssistantTextUtils.normalizeAssistantBodyText(content); }

  static splitMessageBlocks(content: string): MessageBlock[] {
  const source = String(content || '');
  if (!source.trim()) return [{ type: 'text', content: source }];

  const blocks: MessageBlock[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const start = match.index;
    const end = regex.lastIndex;
    if (start > cursor) {
      blocks.push({ type: 'text', content: source.slice(cursor, start) });
    }
    blocks.push({
      type: 'code',
      language: String(match[1] || '').trim(),
      content: String(match[2] || '').replace(/\n$/, ''),
    });
    cursor = end;
  }

  if (cursor < source.length) {
    blocks.push({ type: 'text', content: source.slice(cursor) });
  }
  return blocks;
  }

  static renderInlineFormat(text: string, keyPrefix: string): React.ReactNode[] {
  const source = String(text || '');
  if (!source) return [''];

  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*.+?\*\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const start = match.index;
    const token = match[0];
    if (start > cursor) nodes.push(source.slice(cursor, start));

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        React.createElement('code', {
          key: `${keyPrefix}-code-${start}`,
          className: 'rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900',
        }, token.slice(1, -1)),
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        React.createElement('strong', {
          key: `${keyPrefix}-strong-${start}`,
          className: 'font-bold',
        }, token.slice(2, -2)),
      );
    } else {
      nodes.push(token);
    }
    cursor = start + token.length;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
  }

  static renderText(content: string, keyPrefix: string): React.ReactNode {
  const lines = String(content || '').split('\n');
  const blocks: React.ReactNode[] = [];
  const bulletItems: string[] = [];
  const orderedItems: string[] = [];

  const normalizeLine = (line: string): string => {
    const text = String(line || '').trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1).trim();
    }
    return text;
  };

  const renderKeyValueLine = (line: string, lineKey: string): React.ReactNode => {
    const normalized = normalizeLine(line);
    const keyValue = normalized.match(/^([A-Za-z0-9_.-]+):(.*)$/);
    if (!keyValue) return AssistantTextUtils.renderInlineFormat(normalized, lineKey);
    const key = keyValue[1];
    const rest = keyValue[2] || '';
    return React.createElement(
      React.Fragment,
      null,
      React.createElement('strong', null, `${key}:`),
      rest
        ? React.createElement(React.Fragment, null, ' ', ...AssistantTextUtils.renderInlineFormat(rest.trim(), `${lineKey}-rest`))
        : null,
    );
  };

  const flushBulletItems = () => {
    if (!bulletItems.length) return;
    const startIndex = blocks.length;
    blocks.push(
      React.createElement(
        'ul',
        { key: `${keyPrefix}-ul-${startIndex}`, className: 'list-disc space-y-1 pl-5' },
        ...bulletItems.map((item, itemIndex) =>
          React.createElement(
            'li',
            { key: `${keyPrefix}-ul-item-${itemIndex}`, className: 'whitespace-pre-wrap break-words leading-relaxed' },
            renderKeyValueLine(item, `${keyPrefix}-ul-${itemIndex}`),
          ),
        ),
      ),
    );
    bulletItems.length = 0;
  };

  const flushOrderedItems = () => {
    if (!orderedItems.length) return;
    const startIndex = blocks.length;
    blocks.push(
      React.createElement(
        'ol',
        { key: `${keyPrefix}-ol-${startIndex}`, className: 'list-decimal space-y-1 pl-5' },
        ...orderedItems.map((item, itemIndex) =>
          React.createElement(
            'li',
            { key: `${keyPrefix}-ol-item-${itemIndex}`, className: 'whitespace-pre-wrap break-words leading-relaxed' },
            renderKeyValueLine(item, `${keyPrefix}-ol-${itemIndex}`),
          ),
        ),
      ),
    );
    orderedItems.length = 0;
  };

  lines.forEach((line, index) => {
    const trimmed = normalizeLine(line);
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
      blocks.push(React.createElement('div', { key: `${keyPrefix}-gap-${index}`, className: 'h-1' }));
      return;
    }
    blocks.push(
      React.createElement(
        'p',
        { key: `${keyPrefix}-line-${index}`, className: 'whitespace-pre-wrap break-words leading-relaxed' },
        renderKeyValueLine(trimmed, `${keyPrefix}-${index}`),
      ),
    );
  });

  flushBulletItems();
  flushOrderedItems();

  return React.createElement('div', { className: 'space-y-1.5' }, blocks);
  }

  static serializeAttachmentsForModel(attachments: UploadedAttachment[]): string {
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

  static stripReadyMessage(entries: AssistantMessage[]): AssistantMessage[] {
  return entries.filter((entry, index) => {
    if (
      index === 0 &&
      entry.role === 'system' &&
      String(entry.content || '').toLowerCase().includes('ready')
    ) {
      return false;
    }
    return true;
  });
  }

  static summarizeSessionTitle(entries: AssistantMessage[]): string {
  const firstUser = entries.find((entry) => entry.role === 'user' && String(entry.content || '').trim());
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
