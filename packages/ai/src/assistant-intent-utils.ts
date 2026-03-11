import type { AssistantMessage } from './assistant-core-constants.types';

export class AssistantIntentUtils {

  static isApprovalPrompt(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;
  return /^(yes|ok|okay|approve|apply|run|do it|go ahead|confirm|proceed)\b/.test(normalized);
  }

  static hasPlanningIntent(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  if (!normalized.trim()) return false;
  if (/\bwhat can you plan\b|\bcan you plan\b|\bhow (?:do|does) .*plan\b|\bexplain plan\b/.test(normalized)) return false;
  return /(replace|change|update|create|delete|remove|fix|set|install|uninstall|rename|modify|stage|apply|migrate|edit)\b/.test(normalized);
  }

  static isPlanGuidanceMessage(entry: AssistantMessage): boolean {
  if (entry.role !== 'assistant') return false;
  if (Array.isArray(entry.actions) && entry.actions.length > 0) return false;
  const text = String(entry.content || '').toLowerCase();
  if (!text) return false;
  return (
    /plan mode|switch to plan|stage(?:d)? actions|review staged|approve/.test(text) &&
    !/staged actions \(\d+\)/.test(text)
  );
  }

  static shouldShowPlanCard(entry: AssistantMessage): boolean {
  if (entry.role !== 'assistant' || !entry.plan) return false;
  const status = String(entry.plan.status || '').trim().toLowerCase();
  const hasActions = Array.isArray(entry.actions) && entry.actions.length > 0;
  const shouldShowForStatus = ['searching', 'staged', 'paused', 'ready_for_preview', 'ready_for_apply', 'failed'].includes(status);
  if (hasActions) return true;
  if (entry.ui?.canContinue || entry.ui?.requiresApproval) return true;
  return shouldShowForStatus;
  }

  static shouldHideAssistantBody(entry: AssistantMessage): boolean {
  if (entry.role !== 'assistant') return false;
  if (entry.plan && AssistantIntentUtils.shouldShowPlanCard(entry)) return true;
  const text = String(entry.content || '').trim();
  if (!text) return false;
  if (/^\{[\s\S]*"actions"[\s\S]*\}$/.test(text)) return true;
  const looksLikePlanDump =
    /^plan\b/i.test(text) ||
    /^goal:/im.test(text) ||
    /^exact search:/im.test(text) ||
    /^staged:/im.test(text) ||
    /^next:/im.test(text);
  const hasActions = Array.isArray(entry.actions) && entry.actions.length > 0;
  return looksLikePlanDump && hasActions;
  }
}
