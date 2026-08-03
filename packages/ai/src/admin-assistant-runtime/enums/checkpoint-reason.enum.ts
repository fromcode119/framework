import { Enum } from '@fromcode119/reactor';

/** Why a run checkpointed. */
export class CheckpointReason extends Enum {
  static readonly LOOP_CAP = new CheckpointReason('loop_cap');
  static readonly TIME_CAP = new CheckpointReason('time_cap');
  static readonly USER_CONTINUE = new CheckpointReason('user_continue');
  static readonly CLARIFICATION_NEEDED = new CheckpointReason('clarification_needed');
  static readonly LOOP_RECOVERY = new CheckpointReason('loop_recovery');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to LOOP_CAP. */
  static resolve(value: unknown): CheckpointReason {
    if (value instanceof CheckpointReason) return value;
    const found = CheckpointReason.fromValue(String(value ?? '').trim());
    return (found as CheckpointReason | undefined) ?? CheckpointReason.LOOP_CAP;
  }
}
