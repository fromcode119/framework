import { TextHelpers } from './text-helpers';

/**
 * Short follow-up / match-inquiry detection helpers for the AI runtime classifier.
 * Extracted from ClassifierHelpers to keep files under the line limit.
 */
export class ClassifierFollowupHelpers {
  /**
   * Check if message is a short follow-up (yes, ok, apply)
   *
   * @param message - The user message
   * @returns True if it's a short affirmative follow-up
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
   * Check if message looks like a homepage draft request
   *
   * @param text - The user message
   * @returns True if it looks like a homepage draft request
   */
  static looksHomepageDraft(text: string): boolean {
    const asksHomepage = /\b(homepage|home page|landing page)\b/.test(text);
    const asksDraft = /\b(draft|first version|write|create|generate|build)\b/.test(text);
    const hasSections = /\bhero\b/.test(text) && /\bcta\b/.test(text) && /\bfaq\b/.test(text);
    return (asksHomepage && (asksDraft || hasSections)) || (asksDraft && hasSections);
  }
}
