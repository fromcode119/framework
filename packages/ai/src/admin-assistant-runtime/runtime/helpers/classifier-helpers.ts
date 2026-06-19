import { ClassifierUrlHelpers } from './classifier-url-helpers';
import { ClassifierReplaceHelpers } from './classifier-replace-helpers';
import { ClassifierFollowupHelpers } from './classifier-followup-helpers';
import { ClassifierClarificationHelpers } from './classifier-clarification-helpers';

/**
 * Classifier utilities for AI runtime
 * Handles intent parsing, pattern matching, and clarification logic.
 *
 * This class is the public entry point; cohesive helper groups are delegated to
 * sibling classes (URL/math, replace parsing, follow-up detection, clarification).
 */
export class ClassifierHelpers {
  /** @see ClassifierUrlHelpers.findUrlHint */
  static findUrlHint(value: string): string | undefined {
    return ClassifierUrlHelpers.findUrlHint(value);
  }

  /** @see ClassifierUrlHelpers.normalizeArithmeticPrompt */
  static normalizeArithmeticPrompt(value: string): string {
    return ClassifierUrlHelpers.normalizeArithmeticPrompt(value);
  }

  /** @see ClassifierUrlHelpers.tryEvalMathExpression */
  static tryEvalMathExpression(prompt: string): string | null {
    return ClassifierUrlHelpers.tryEvalMathExpression(prompt);
  }

  /** @see ClassifierReplaceHelpers.parseReplaceInstruction */
  static parseReplaceInstruction(prompt: string): { from: string; to: string } | null {
    return ClassifierReplaceHelpers.parseReplaceInstruction(prompt);
  }

  /** @see ClassifierFollowupHelpers.looksHomepageDraft */
  static looksHomepageDraft(text: string): boolean {
    return ClassifierFollowupHelpers.looksHomepageDraft(text);
  }

  /** @see ClassifierReplaceHelpers.findLatestReplaceFromHistory */
  static findLatestReplaceFromHistory(
    history: Array<{ role?: string; content?: string }>,
  ): { from: string; to: string } | null {
    return ClassifierReplaceHelpers.findLatestReplaceFromHistory(history);
  }

  /** @see ClassifierFollowupHelpers.isShortFollowUp */
  static isShortFollowUp(message: string): boolean {
    return ClassifierFollowupHelpers.isShortFollowUp(message);
  }

  /** @see ClassifierFollowupHelpers.isMatchInquiryFollowUp */
  static isMatchInquiryFollowUp(message: string): boolean {
    return ClassifierFollowupHelpers.isMatchInquiryFollowUp(message);
  }

  /** @see ClassifierClarificationHelpers.shouldResumeFromClarification */
  static shouldResumeFromClarification(input: {
    message: string;
    checkpointReason?: string;
    checkpointStage?: string;
  }): boolean {
    return ClassifierClarificationHelpers.shouldResumeFromClarification(input);
  }

  /** @see ClassifierClarificationHelpers.isClarificationFlow */
  static isClarificationFlow(checkpoint?: { reason?: string; stage?: string }): boolean {
    return ClassifierClarificationHelpers.isClarificationFlow(checkpoint);
  }

  /** @see ClassifierClarificationHelpers.getLatestAssistantMessage */
  static getLatestAssistantMessage(history: Array<{ role?: string; content?: string }>): string {
    return ClassifierClarificationHelpers.getLatestAssistantMessage(history);
  }

  /** @see ClassifierClarificationHelpers.buildClarificationQuickAnswer */
  static buildClarificationQuickAnswer(input: {
    message: string;
    history?: Array<{ role?: string; content?: string }>;
    checkpoint?: { reason?: string; stage?: string };
  }): string | null {
    return ClassifierClarificationHelpers.buildClarificationQuickAnswer(input);
  }
}
