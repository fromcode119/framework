import { Enum } from '@fromcode119/reactor';

/** How a tool failure should be handled. */
export class ToolFailureMode extends Enum {
  static readonly RETRY = new ToolFailureMode('retry');
  static readonly FALLBACK = new ToolFailureMode('fallback');
  static readonly CRITICAL = new ToolFailureMode('critical');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to RETRY. */
  static resolve(value: unknown): ToolFailureMode {
    if (value instanceof ToolFailureMode) return value;
    const found = ToolFailureMode.fromValue(String(value ?? '').trim());
    return (found as ToolFailureMode | undefined) ?? ToolFailureMode.RETRY;
  }
}
