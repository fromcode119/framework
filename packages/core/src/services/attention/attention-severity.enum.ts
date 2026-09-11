import { Enum } from '@fromcode119/react-class-components';

/**
 * How loudly an item asks for the operator.
 *
 * Three levels and no more: a scale an operator has to learn is a scale they ignore. CRITICAL is
 * "something is broken right now", WARNING is "work is queueing", INFO is "worth knowing, nothing
 * is wrong". The dashboard orders by this and colours by it; nothing else reads it.
 */
export class AttentionSeverity extends Enum {
  static readonly CRITICAL = new AttentionSeverity('critical', 0);
  static readonly WARNING = new AttentionSeverity('warning', 1);
  static readonly INFO = new AttentionSeverity('info', 2);

  private constructor(value: string, readonly rank: number) {
    super(value);
  }

  /** Hydrate an untrusted value — a plugin's provider supplies this over the wire. */
  static resolve(value: unknown): AttentionSeverity {
    if (value instanceof AttentionSeverity) return value;
    return (AttentionSeverity.fromValue(String(value ?? '').trim().toLowerCase()) as AttentionSeverity | undefined)
      ?? AttentionSeverity.INFO;
  }
}
