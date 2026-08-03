import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import type { AssistantRole } from '@ai/enums/assistant-role.enum';
import type { IRuntimeIntent } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-intent.interface';
import { ClassifierHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/classifier-helpers';
import { TextHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/text-helpers';
import { FactualQueryHelpers } from '@ai/admin-assistant-runtime/runtime/factual-query-helpers';
import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';


export class IntentClassifier {
  private static readonly GREETING_RE = /^(hi|hey|hello|yo|sup|good\s+(morning|afternoon|evening))([!.?\s]*)$/i;
  private static readonly CHIT_CHAT_RE = /^(let'?s\s+chat|wanna\s+chat|can\s+we\s+chat|chat)$/i;
  private static readonly FACTUAL_QUESTION_RE = /^(what|who|when|where|why|how)\b/i;
  private static readonly FACTUAL_REQUEST_RE = /^(can|could|would|do)\s+you\s+(tell|show|check|find|list|look\s+up|lookup|inspect|access|see|use)\b/i;
  private static readonly WORKSPACE_FACTUAL_RE = /\b(revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount|finance|plugin|plugins|models?|settings|history|collection|collections)\b/i;
  private static readonly ACTION_VERB_RE = /\b(change|chage|chanege|update|edit|modify|set|rename|replace|fix)\b/;
  /**
   * Classifies user intent from message and conversation context.
   * @param input - Message, history, and checkpoint context
   * @returns Classified intent with confidence score
   * @example
   * const intent = IntentClassifier.classifyIntent({
   *   message: 'Change title to Hello World',
   *   history: []
   * });
   * // => { kind: RuntimeIntentKind.ACTION_REQUEST, confidence: 0.63 }
   */
  static classifyIntent(input: {
    message: string;
    history?: Array<{ role?: AssistantRole; content?: string }>;
    checkpoint?: { reason?: CheckpointReason; stage?: RuntimeStage };
  }): IRuntimeIntent {
    const message = String(input.message || '').trim();
    const analysisMessage = FactualQueryHelpers.trimLeadingGreeting(message) || message;
    const text = TextHelpers.normalize(message);
    const analysisText = TextHelpers.normalize(analysisMessage);
    const urlHint = ClassifierHelpers.findUrlHint(message);
    const hasHistoryContext = Array.isArray(input.history) && input.history.length >= 2;

    if (IntentClassifier.GREETING_RE.test(message) && analysisMessage === message && !hasHistoryContext) {
      return { kind: RuntimeIntentKind.SMALLTALK, confidence: 0.98 };
    }

  if (IntentClassifier.CHIT_CHAT_RE.test(analysisText)) {
    return { kind: RuntimeIntentKind.SMALLTALK, confidence: 0.95 };
  }

  if (/\bhow are you\b|\bhow'?s it going\b|\bhow is it going\b/.test(analysisText)) {
    return { kind: RuntimeIntentKind.SMALLTALK, confidence: 0.9 };
  }

  const quickMathAnswer = ClassifierHelpers.tryEvalMathExpression(message);
  if (quickMathAnswer) {
    return { kind: RuntimeIntentKind.FACTUAL_QA, confidence: 0.99, quickAnswer: quickMathAnswer };
  }

  const clarificationQuickAnswer = ClassifierHelpers.buildClarificationQuickAnswer({
    message,
    history: input.history,
    checkpoint: input.checkpoint,
  });
  if (clarificationQuickAnswer) {
    return { kind: RuntimeIntentKind.FACTUAL_QA, confidence: 0.9, quickAnswer: clarificationQuickAnswer, urlHint };
  }

  const directReplace = ClassifierHelpers.parseReplaceInstruction(analysisMessage);
  if (directReplace) {
    return {
      kind: RuntimeIntentKind.REPLACE_TEXT,
      confidence: 0.95,
      replace: directReplace,
      urlHint,
      queryHint: directReplace.from,
    };
  }

  const previousReplace = ClassifierHelpers.findLatestReplaceFromHistory(input.history || []);
  if (previousReplace && (
    ClassifierHelpers.isShortFollowUp(analysisMessage) ||
    ClassifierHelpers.isMatchInquiryFollowUp(analysisMessage) ||
    ClassifierHelpers.shouldResumeFromClarification({
      message: analysisMessage,
      checkpointReason: input.checkpoint?.reason,
      checkpointStage: input.checkpoint?.stage,
    })
  )) {
    return {
      kind: RuntimeIntentKind.REPLACE_TEXT,
      confidence: 0.79,
      replace: previousReplace,
      urlHint,
      queryHint: previousReplace.from,
    };
  }

  if (
    !previousReplace &&
    ClassifierHelpers.shouldResumeFromClarification({
      message: analysisMessage,
      checkpointReason: input.checkpoint?.reason,
      checkpointStage: input.checkpoint?.stage,
    })
  ) {
    return {
      kind: RuntimeIntentKind.ACTION_REQUEST,
      confidence: 0.68,
      urlHint,
    };
  }

  if (ClassifierHelpers.looksHomepageDraft(analysisText)) {
    return {
      kind: RuntimeIntentKind.HOMEPAGE_DRAFT,
      confidence: 0.9,
      urlHint,
    };
  }

  if (IntentClassifier.ACTION_VERB_RE.test(analysisText)) {
    return {
      kind: RuntimeIntentKind.ACTION_REQUEST,
      confidence: 0.63,
      urlHint,
    };
  }

  if (/\bwhat can you do|capabilities|how can you help\b/.test(analysisText)) {
    return {
      kind: RuntimeIntentKind.CHAT,
      confidence: 0.9,
    };
  }

  if (
    IntentClassifier.FACTUAL_QUESTION_RE.test(analysisText) ||
    (IntentClassifier.FACTUAL_REQUEST_RE.test(analysisMessage) && IntentClassifier.WORKSPACE_FACTUAL_RE.test(analysisMessage)) ||
    FactualQueryHelpers.looksLikeReadOnlyDataQuestion(analysisMessage)
  ) {
    return {
      kind: RuntimeIntentKind.FACTUAL_QA,
      confidence: IntentClassifier.FACTUAL_QUESTION_RE.test(analysisText) ? 0.74 : 0.72,
      urlHint,
    };
  }

    if (hasHistoryContext) {
      return {
        kind: RuntimeIntentKind.CHAT,
        confidence: 0.55,
        urlHint,
      };
    }

    return {
      kind: RuntimeIntentKind.CHAT,
      confidence: 0.45,
      urlHint,
    };
  }
}
