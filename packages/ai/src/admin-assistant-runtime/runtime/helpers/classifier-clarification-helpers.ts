import { TextHelpers } from './text-helpers';
import { ClassifierUrlHelpers } from './classifier-url-helpers';
import { ClassifierFollowupHelpers } from './classifier-followup-helpers';

/**
 * Clarification-flow helpers for the AI runtime classifier.
 * Extracted from ClassifierHelpers to keep files under the line limit.
 */
export class ClassifierClarificationHelpers {
  /**
   * Check if should resume from clarification state
   *
   * @param input - Object with message and checkpoint state
   * @returns True if the follow-up should resume execution
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
    if (ClassifierUrlHelpers.findUrlHint(input.message)) return true;
    if (ClassifierFollowupHelpers.isShortFollowUp(input.message)) return true;
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
   */
  static buildClarificationQuickAnswer(input: {
    message: string;
    history?: Array<{ role?: string; content?: string }>;
    checkpoint?: { reason?: string; stage?: string };
  }): string | null {
    if (!ClassifierClarificationHelpers.isClarificationFlow(input.checkpoint)) return null;
    const text = TextHelpers.normalize(input.message).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const latestAssistant = ClassifierClarificationHelpers.getLatestAssistantMessage(input.history || []);
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
