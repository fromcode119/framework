import { Enum } from '@fromcode119/reactor';

/** Pipeline stage of a read-only chat turn. */
export class RuntimeStage extends Enum {
  static readonly CLASSIFY = new RuntimeStage('classify');
  static readonly RETRIEVE = new RuntimeStage('retrieve');
  static readonly PLAN = new RuntimeStage('plan');
  static readonly CLARIFY = new RuntimeStage('clarify');
  static readonly FINALIZE = new RuntimeStage('finalize');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to CLASSIFY. */
  static resolve(value: unknown): RuntimeStage {
    if (value instanceof RuntimeStage) return value;
    const found = RuntimeStage.fromValue(String(value ?? '').trim());
    return (found as unknown as RuntimeStage | undefined) ?? RuntimeStage.CLASSIFY;
  }
}
