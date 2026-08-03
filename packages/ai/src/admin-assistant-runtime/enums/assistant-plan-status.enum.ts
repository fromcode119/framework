import { Enum } from '@fromcode119/reactor';

/**
 * Lifecycle state of an assistant plan artifact.
 *
 * `showsPlanCard` marks the statuses where the chat surfaces the plan card — a property OF the status,
 * so it lives on the member rather than in a `['searching','staged',…].includes(status)` array copied
 * into every consumer (it was duplicated in two).
 */
export class AssistantPlanStatus extends Enum {
  static readonly DRAFT = new AssistantPlanStatus('draft');
  static readonly SEARCHING = new AssistantPlanStatus('searching', true);
  static readonly STAGED = new AssistantPlanStatus('staged', true);
  static readonly PAUSED = new AssistantPlanStatus('paused', true);
  static readonly READY_FOR_PREVIEW = new AssistantPlanStatus('ready_for_preview', true);
  static readonly READY_FOR_APPLY = new AssistantPlanStatus('ready_for_apply', true);
  static readonly COMPLETED = new AssistantPlanStatus('completed');
  static readonly FAILED = new AssistantPlanStatus('failed', true);

  private constructor(value: string, readonly showsPlanCard = false) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to DRAFT. */
  static resolve(value: unknown): AssistantPlanStatus {
    if (value instanceof AssistantPlanStatus) return value;
    const found = AssistantPlanStatus.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as AssistantPlanStatus | undefined) ?? AssistantPlanStatus.DRAFT;
  }
}
