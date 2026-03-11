import type { RuntimeIntent } from '../types.types';
import { TextHelpers } from './text-helpers';

/**
 * Classifier utilities for AI runtime
 * Handles intent parsing, pattern matching, and clarification logic
 */
export class ClassifierHelpers {
  /**
   * Find URL hint in user message
   * 
   * @param value - The user message
   * @returns URL or path string if found
   * 
   * @example
   * const url = ClassifierHelpers.findUrlHint('Check https://example.com/page');
   * // => "https://example.com/page"
   */
  static findUrlHint(value: string): string | undefined {
    const match = String(value || '').match(/https?:\/\/[^\s)]+/i);
    if (match?.[0]) return match[0];
    const pathMatch = String(value || '').match(/\/(?:examples|preview|pages)\/[a-z0-9\-_\/]+/i);
    return pathMatch?.[0] || undefined;
  }

  /**
   * Normalize arithmetic expressions for evaluation
   * 
   * @param value - The arithmetic prompt
   * @returns Normalized expression string
   * 
   * @example
   * const expr = ClassifierHelpers.normalizeArithmeticPrompt('5 plus 3 times 2');
   * // => "5 + 3 * 2"
   */
  static normalizeArithmeticPrompt(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/\bplus\b/g, '+')
      .replace(/\bminus\b/g, '-')
      .replace(/\b(times|multiplied by|x)\b/g, '*')
      .replace(/\b(divided by|over)\b/g, '/')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Try to evaluate a math expression from user prompt
   * 
   * @param prompt - The user's arithmetic question
   * @returns Evaluated result as string, or null if not a valid math expression
   * 
   * @example
   * const result = ClassifierHelpers.tryEvalMathExpression('what is 5 + 3');
   * // => "8"
   */
  static tryEvalMathExpression(prompt: string): string | null {
    const normalized = ClassifierHelpers.normalizeArithmeticPrompt(prompt);
    const match = normalized.match(
      /^(?:what(?:'s| is)?|calculate|compute|solve)?\s*\(?\s*([\-+]?\d+(?:\.\d+)?(?:\s*[\+\-\*\/]\s*[\-+]?\d+(?:\.\d+)?)+)\s*\)?\s*\??$/,
    );
    const expression = String(match?.[1] || '').trim();
    if (!expression) return null;
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) return null;
    try {
      // Expression is tightly sanitized to digits/operators/whitespace.
      const value = Function(`"use strict"; return (${expression});`)();
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      const rounded = Math.round(value * 1_000_000) / 1_000_000;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    } catch {
      return null;
    }
  }

  /**
   * Parse replace instruction from user message
   * 
   * @param prompt - The user message
   * @returns Object with from and to strings, or null if not a replace instruction
   * 
   * @example
   * const parsed = ClassifierHelpers.parseReplaceInstruction('change "old" to "new"');
   * // => { from: 'old', to: 'new' }
   */
  static parseReplaceInstruction(prompt: string): { from: string; to: string } | null {
    const sourceRaw = String(prompt || '').trim();
    if (!sourceRaw) return null;
    const source = sourceRaw.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();

    const patterns: RegExp[] = [
      /(?:change|replace|update|set|chage|chanege)[^%\n]{0,120}([+-]?\d+(?:\.\d+)?%)\b[\s\S]{0,80}?\bto\b\s*([+-]?\d+(?:\.\d+)?%)\b/i,
      /([+-]?\d+(?:\.\d+)?%)\s*(?:->|to)\s*([+-]?\d+(?:\.\d+)?%)\b/i,
      /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
      /update\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /chage\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /chanege\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s+(?:to|with)\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s*->\s*["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      const from = String(match?.[1] || '').trim();
      const to = String(match?.[2] || '').trim();
      if (from && to && from.toLowerCase() !== to.toLowerCase()) {
        return { from, to };
      }
    }

    const unquoted = source.match(
      /^(?:can you|could you|please)?\s*(?:change|chage|chanege|replace|update|rename|swap|substitute)\s+(.+?)\s+(?:with|to)\s+(.+?)\s*$/i,
    );
    if (unquoted) {
      const from = String(unquoted[1] || '')
        .trim()
        .replace(/^['"""'']+/, '')
        .replace(/['"""'']+$/, '')
        .trim();
      const to = String(unquoted[2] || '')
        .trim()
        .replace(/^['"""'']+/, '')
        .replace(/['"""'']+$/, '')
        .trim();
      if (from && to && from.toLowerCase() !== to.toLowerCase()) {
        return { from, to };
      }
    }

    return null;
  }

  /**
   * Check if message looks like a homepage draft request
   * 
   * @param text - The user message
   * @returns True if it looks like a homepage draft request
   * 
   * @example
   * const isDraft = ClassifierHelpers.looksHomepageDraft('create homepage with hero and cta');
   * // => true
   */
  static looksHomepageDraft(text: string): boolean {
    const asksHomepage = /\b(homepage|home page|landing page)\b/.test(text);
    const asksDraft = /\b(draft|first version|write|create|generate|build)\b/.test(text);
    const hasSections = /\bhero\b/.test(text) && /\bcta\b/.test(text) && /\bfaq\b/.test(text);
    return (asksHomepage && (asksDraft || hasSections)) || (asksDraft && hasSections);
  }

  /**
   * Find the latest replace instruction from conversation history
   * 
   * @param history - Array of conversation messages
   * @returns Object with from and to strings, or null if not found
   * 
   * @example
   * const latest = ClassifierHelpers.findLatestReplaceFromHistory(history);
   * // => { from: 'old', to: 'new' }
   */
  static findLatestReplaceFromHistory(
    history: Array<{ role?: string; content?: string }>,
  ): { from: string; to: string } | null {
    const source = Array.isArray(history) ? history : [];
    for (let i = source.length - 1; i >= 0; i -= 1) {
      const entry = source[i];
      if (String(entry?.role || '').toLowerCase() !== 'user') continue;
      const parsed = ClassifierHelpers.parseReplaceInstruction(String(entry?.content || ''));
      if (parsed) return parsed;
    }
    return null;
  }

  /**
   * Check if message is a short follow-up (yes, ok, apply)
   * 
   * @param message - The user message
   * @returns True if it's a short affirmative follow-up
   * 
   * @example
   * const isShort = ClassifierHelpers.isShortFollowUp('ok do it');
   * // => true
   */
  static isShortFollowUp(message: string): boolean {
    const text = TextHelpers.normalize(message).replace(/[^a-z0-9\s]+/g, ' ').trim();
    if (!text) return false;
    if (text.length <= 36 && /\b(ok|okay|yes|yeah|do it|apply|change it|update it|continue|go ahead)\b/.test(text)) return true;
    return text.split(/\s+/).length <= 6 && /\b(ok|yes|apply|go|change|update|it|continue|done)\b/.test(text);
  }

  /**
   * Check if message is asking about matches found
   * 
   * @param message - The user message
   * @returns True if asking about match locations or files
   * 
   * @example
   * const isInquiry = ClassifierHelpers.isMatchInquiryFollowUp('where are the matches?');
   * // => true
   */
  static isMatchInquiryFollowUp(message: string): boolean {
    const text = TextHelpers.normalize(message).replace(/\s+/g, ' ').trim();
    if (!text) return false;
    if (/\b(show|list)\b[\s\w]{0,24}\b(matches|match|files|locations)\b/.test(text)) return true;
    if (/\b(what|which|where)\b[\s\w]{0,28}\b(matches|match|files|locations|found)\b/.test(text)) return true;
    if (/\bwhere\b[\s\w]{0,16}\b(they|those|them)\b/.test(text)) return true;
    return false;
  }

  /**
   * Check if should resume from clarification state
   * 
   * @param input - Object with message and checkpoint state
   * @returns True if the follow-up should resume execution
   * 
   * @example
   * const shouldResume = ClassifierHelpers.shouldResumeFromClarification({ message: 'yes', checkpointReason: 'clarification_needed' });
   * // => true
   */
  static shouldResumeFromClarification(input: {
    message: string;
    checkpointReason?: string;
    checkpointStage?: string;
  }): boolean {
    const text = TextHelpers.normalize(input.message).replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const reason = String(input.checkpointReason || '').trim().toLowerCase();
    const stage = String(input.checkpointStage || '').trim().toLowerCase();
    const inClarificationFlow =
      reason === 'clarification_needed' ||
      reason === 'loop_recovery' ||
      stage === 'clarify';
    if (!inClarificationFlow) return false;
    if (ClassifierHelpers.findUrlHint(input.message)) return true;
    if (ClassifierHelpers.isShortFollowUp(input.message)) return true;
    if (/\b(it'?s|its|this|that|there|here)\b/.test(text)) return true;
    if (/\b(i have no idea|not sure|don'?t know)\b/.test(text)) return true;
    if (/\b(phone|number|email|title|field|page|homepage|plugin|theme)\b/.test(text)) return true;
    return false;
  }

  /**
   * Check if checkpoint state indicates clarification flow
   * 
   * @param checkpoint - The checkpoint object
   * @returns True if in clarification flow
   * 
   * @example
   * const isClarifying = ClassifierHelpers.isClarificationFlow({ reason: 'clarification_needed' });
   * // => true
   */
  static isClarificationFlow(checkpoint?: { reason?: string; stage?: string }): boolean {
    const reason = String(checkpoint?.reason || '').trim().toLowerCase();
    const stage = String(checkpoint?.stage || '').trim().toLowerCase();
    return reason === 'clarification_needed' || reason === 'loop_recovery' || stage === 'clarify';
  }

  /**
   * Get the latest assistant message from history
   * 
   * @param history - Array of conversation messages
   * @returns The latest assistant message content
   * 
   * @example
   * const latest = ClassifierHelpers.getLatestAssistantMessage(history);
   * // => "I found 5 matches in your content..."
   */
  static getLatestAssistantMessage(history: Array<{ role?: string; content?: string }>): string {
    const source = Array.isArray(history) ? history : [];
    for (let i = source.length - 1; i >= 0; i -= 1) {
      if (String(source[i]?.role || '').toLowerCase() !== 'assistant') continue;
      return String(source[i]?.content || '').trim();
    }
    return '';
  }

  /**
   * Build a quick answer for common clarification questions
   * 
   * @param input - Object with message, history, and checkpoint
   * @returns Quick answer string, or null if not applicable
   * 
   * @example
   * const answer = ClassifierHelpers.buildClarificationQuickAnswer({ message: 'what do you mean?', history, checkpoint });
   * // => "CMS content means text stored in content records..."
   */
  static buildClarificationQuickAnswer(input: {
    message: string;
    history?: Array<{ role?: string; content?: string }>;
    checkpoint?: { reason?: string; stage?: string };
  }): string | null {
    if (!ClassifierHelpers.isClarificationFlow(input.checkpoint)) return null;
    const text = TextHelpers.normalize(input.message).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const latestAssistant = ClassifierHelpers.getLatestAssistantMessage(input.history || []);
    const askedScopeChoice =
      /\bcms\/content\b/.test(latestAssistant.toLowerCase()) &&
      /\bfile changes\b/.test(latestAssistant.toLowerCase());

    const asksMeaning =
      /\bwhat do you mean\b/.test(text) ||
      /\bwhat is\b/.test(text) ||
      /\bmean by\b/.test(text) ||
      /\bmeaning\b/.test(text);
    const asksWhy = /^why\b/.test(text) || /\bwhy\?$/.test(text);

    if (askedScopeChoice && (asksMeaning || /\b(cms|content)\b/.test(text))) {
      return [
        'CMS/content means text stored in content records (for example pages/posts in your CMS collections), not source code files.',
        'If you choose CMS, I update those record values.',
        'If you choose files, I edit theme/plugin source files.',
        'Reply with "CMS" or "files".',
      ].join(' ');
    }

    if (askedScopeChoice && asksWhy) {
      return [
        'I asked because I found matches only in source files, and applying them would edit code.',
        'I need your choice before staging writes: update CMS/content values instead, or apply file edits.',
      ].join(' ');
    }

    if (asksWhy && /need one detail/.test(latestAssistant.toLowerCase())) {
      return 'I need one missing target detail so I can stage the correct change safely instead of guessing.';
    }

    return null;
  }
}
