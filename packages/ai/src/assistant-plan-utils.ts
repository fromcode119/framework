import type { AssistantMessage, UploadedAttachment, PlanCardSummary, ExecutionCardSummary } from './assistant-core-constants.types';
import { AssistantSurfaceUtils } from './assistant-surface-utils';
import { AssistantTextUtils } from './assistant-text-utils';

export class AssistantPlanUtils {
  static sanitizeTraceToolCalls(input: any): Array<{ tool?: string; input?: Record<string, any> }> { return AssistantPlanUtils.sanitizeTraceToolCalls(input); }

  static buildPlanCardSummary(entry: AssistantMessage): PlanCardSummary {
  const plan = entry.plan;
  const actionCount = Array.isArray(entry.actions) ? entry.actions.length : 0;
  const baseSummary = AssistantTextUtils.normalizeAssistantBodyText(entry.content || plan?.summary || '');
  const status = String(plan?.status || '').trim().toLowerCase();
  const goal = String(plan?.goal || '').trim() || 'Planned workspace update';
  const needsClarification = entry.ui?.needsClarification === true;
  const clarifyingQuestion = String(entry.ui?.clarifyingQuestion || '').trim();
  const loopRecoveryMode = entry.ui?.loopRecoveryMode || 'none';

  const found =
    baseSummary ||
    (actionCount > 0
      ? `I found ${actionCount} safe change${actionCount > 1 ? 's' : ''} that match your request.`
      : status === 'failed'
        ? 'I could not stage safe actions yet.'
        : 'I reviewed your request and prepared the next safe step.');

  const propose =
    actionCount > 0
      ? `Stage ${actionCount} change${actionCount > 1 ? 's' : ''} for verification before any write.`
      : needsClarification
        ? clarifyingQuestion || 'Need one detail to finish staging safely.'
      : entry.ui?.canContinue
        ? 'Need one detail to finish staging.'
        : 'Broaden discovery and try another pass before proposing writes.';

  const approval =
    actionCount > 0
      ? plan?.previewReady
        ? 'Approve Preview first. If the visual/result diff looks correct, approve Apply.'
        : 'Approve Preview to inspect impact before any write.'
      : needsClarification
        ? loopRecoveryMode === 'best_effort'
          ? 'Review the draft, confirm target collection + record, then approve changes.'
          : 'Reply with the missing target details so I can stage exact actions.'
        : 'Reply with exact target details so I can stage changes.';

  return { goal, found, propose, approval };
  }

  static buildExecutionCardSummary(execution: any): ExecutionCardSummary {
  const results = Array.isArray(execution?.results) ? execution.results : [];
  const okCount = results.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'ok').length;
  const skippedCount = results.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'skipped').length;
  const failedCount = results.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'failed').length;
  const dryRun = execution?.dryRun === true;

  const changed = dryRun
    ? `${okCount} change${okCount === 1 ? ' is' : 's are'} ready to apply after approval.`
    : `${okCount} change${okCount === 1 ? ' was' : 's were'} applied.`;

  const targets = new Set<string>();
  for (const item of results) {
    const input = item?.input && typeof item.input === 'object' ? item.input : {};
    const target =
      String(
        input?.collectionSlug ||
          input?.slug ||
          item?.output?.target?.collectionSlug ||
          item?.output?.target?.slug ||
          item?.tool ||
          item?.type ||
          '',
      ).trim();
    if (target) targets.add(target);
  }
  const where = targets.size
    ? Array.from(targets).slice(0, 4).join(', ')
    : 'No concrete targets were returned by the run.';

  const statusParts: string[] = [];
  statusParts.push(`${okCount} ok`);
  if (skippedCount) statusParts.push(`${skippedCount} unchanged`);
  if (failedCount) statusParts.push(`${failedCount} failed`);
  const status = statusParts.join(' • ');

  return { changed, where, status };
  }
}
