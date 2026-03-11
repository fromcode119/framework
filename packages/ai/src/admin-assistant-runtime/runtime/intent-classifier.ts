import type { RuntimeIntent } from './types.types';
import { ClassifierHelpers } from './helpers/classifier-helpers';
import { TextHelpers } from './helpers/text-helpers';

const GREETING_RE = /^(hi|hey|hello|yo|sup|good\s+(morning|afternoon|evening))([!.?\s]*)$/i;
const CHIT_CHAT_RE = /^(let'?s\s+chat|wanna\s+chat|can\s+we\s+chat|chat)$/i;
const FACTUAL_QUESTION_RE = /^(what|who|when|where|why|how)\b/i;
const ACTION_VERB_RE = /\b(change|chage|chanege|update|edit|modify|set|rename|replace|fix)\b/;

export class IntentClassifier {
  /**
   * Classifies user intent from message and conversation context.
   * @param input - Message, history, and checkpoint context
   * @returns Classified intent with confidence score
   * @example
   * const intent = IntentClassifier.classifyIntent({
   *   message: 'Change title to Hello World',
   *   history: []
   * });
   * // => { kind: 'action_request', confidence: 0.63 }
   */
  static classifyIntent(input: {
    message: string;
    history?: Array<{ role?: string; content?: string }>;
    checkpoint?: { reason?: string; stage?: string };
  }): RuntimeIntent {
    const message = String(input.message || '').trim();
    const text = TextHelpers.normalize(message);
    const urlHint = ClassifierHelpers.findUrlHint(message);
    const hasHistoryContext = Array.isArray(input.history) && input.history.length >= 2;

    if (GREETING_RE.test(message) && !hasHistoryContext) {
      return { kind: 'smalltalk', confidence: 0.98 };
    }

  if (CHIT_CHAT_RE.test(text)) {
    return { kind: 'smalltalk', confidence: 0.95 };
  }

  const quickMathAnswer = ClassifierHelpers.tryEvalMathExpression(message);
  if (quickMathAnswer) {
    return { kind: 'factual_qa', confidence: 0.99, quickAnswer: quickMathAnswer };
  }

  const clarificationQuickAnswer = ClassifierHelpers.buildClarificationQuickAnswer({
    message,
    history: input.history,
    checkpoint: input.checkpoint,
  });
  if (clarificationQuickAnswer) {
    return { kind: 'factual_qa', confidence: 0.9, quickAnswer: clarificationQuickAnswer, urlHint };
  }

  const directReplace = ClassifierHelpers.parseReplaceInstruction(message);
  if (directReplace) {
    return {
      kind: 'replace_text',
      confidence: 0.95,
      replace: directReplace,
      urlHint,
      queryHint: directReplace.from,
    };
  }

  const previousReplace = ClassifierHelpers.findLatestReplaceFromHistory(input.history || []);
  if (previousReplace && (
    ClassifierHelpers.isShortFollowUp(message) ||
    ClassifierHelpers.isMatchInquiryFollowUp(message) ||
    ClassifierHelpers.shouldResumeFromClarification({
      message,
      checkpointReason: input.checkpoint?.reason,
      checkpointStage: input.checkpoint?.stage,
    })
  )) {
    return {
      kind: 'replace_text',
      confidence: 0.79,
      replace: previousReplace,
      urlHint,
      queryHint: previousReplace.from,
    };
  }

  if (
    !previousReplace &&
    ClassifierHelpers.shouldResumeFromClarification({
      message,
      checkpointReason: input.checkpoint?.reason,
      checkpointStage: input.checkpoint?.stage,
    })
  ) {
    return {
      kind: 'action_request',
      confidence: 0.68,
      urlHint,
    };
  }

  if (ClassifierHelpers.looksHomepageDraft(text)) {
    return {
      kind: 'homepage_draft',
      confidence: 0.9,
      urlHint,
    };
  }

  if (ACTION_VERB_RE.test(text)) {
    return {
      kind: 'action_request',
      confidence: 0.63,
      urlHint,
    };
  }

  if (/\bwhat can you do|capabilities|how can you help\b/.test(text)) {
    return {
      kind: 'chat',
      confidence: 0.9,
    };
  }

  if (FACTUAL_QUESTION_RE.test(text)) {
    return {
      kind: 'factual_qa',
      confidence: 0.74,
      urlHint,
    };
  }

    if (hasHistoryContext) {
      return {
        kind: 'chat',
        confidence: 0.55,
        urlHint,
      };
    }

    return {
      kind: 'chat',
      confidence: 0.45,
      urlHint,
    };
  }
}
