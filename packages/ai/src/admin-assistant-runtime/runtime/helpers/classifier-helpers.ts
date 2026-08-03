import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import type { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ClassifierUrlHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/classifier-url-helpers';
import { ClassifierReplaceHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/classifier-replace-helpers';
import { ClassifierFollowupHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/classifier-followup-helpers';
import { ClassifierClarificationHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/classifier-clarification-helpers';

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
    history: Array<{ role?: AssistantRole; content?: string }>,
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
    checkpointReason?: CheckpointReason;
    checkpointStage?: RuntimeStage;
  }): boolean {
    return ClassifierClarificationHelpers.shouldResumeFromClarification(input);
  }

  /** @see ClassifierClarificationHelpers.isClarificationFlow */
  static isClarificationFlow(checkpoint?: { reason?: CheckpointReason; stage?: RuntimeStage }): boolean {
    return ClassifierClarificationHelpers.isClarificationFlow(checkpoint);
  }

  /** @see ClassifierClarificationHelpers.getLatestAssistantMessage */
  static getLatestAssistantMessage(history: Array<{ role?: AssistantRole; content?: string }>): string {
    return ClassifierClarificationHelpers.getLatestAssistantMessage(history);
  }

  /** @see ClassifierClarificationHelpers.buildClarificationQuickAnswer */
  static buildClarificationQuickAnswer(input: {
    message: string;
    history?: Array<{ role?: AssistantRole; content?: string }>;
    checkpoint?: { reason?: CheckpointReason; stage?: RuntimeStage };
  }): string | null {
    return ClassifierClarificationHelpers.buildClarificationQuickAnswer(input);
  }
}
