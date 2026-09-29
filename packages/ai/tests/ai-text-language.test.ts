// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantConversationEmptyState } from '@ai/components/assistant-conversation-empty-state';
import { AiText } from '@ai/i18n/ai-text';

/** The assistant speaks the console's language — read from `<html lang>`, which the console sets. */
describe('the assistant in the console language', () => {
  afterEach(() => { document.documentElement.lang = ''; });

  it('renders its empty state in Bulgarian when the console is Bulgarian', () => {
    document.documentElement.lang = 'bg';
    const html = renderToStaticMarkup(createElement(AssistantConversationEmptyState));
    expect(html).toContain('С какво мога да помогна?');
    expect(html).not.toContain('How can I help?');
  });

  it('stays English in an English console, and plurals come out whole', () => {
    document.documentElement.lang = 'en';
    expect(renderToStaticMarkup(createElement(AssistantConversationEmptyState))).toContain('How can I help?');
    document.documentElement.lang = 'bg';
    expect(AiText.t('ai.toolCallMany', { count: 3 })).toBe('3 извиквания на инструменти');
  });
});
