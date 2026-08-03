import { Enum } from '@fromcode119/reactor';

/** State of the assistant action workflow. */
export class WorkflowState extends Enum {
  static readonly REPLY = new WorkflowState('reply');
  static readonly CLARIFY = new WorkflowState('clarify');
  static readonly STAGED = new WorkflowState('staged');
  static readonly PREVIEWED = new WorkflowState('previewed');
  static readonly APPLIED = new WorkflowState('applied');
  static readonly STALE = new WorkflowState('stale');

  private constructor(value: string) {
    super(value);
  }
}
