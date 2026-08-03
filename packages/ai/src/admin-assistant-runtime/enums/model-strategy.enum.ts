import { Enum } from '@fromcode119/reactor';

/** Model-routing strategy for a turn. */
export class ModelStrategy extends Enum {
  static readonly CHEAP_DISCOVERY = new ModelStrategy('cheap_discovery');
  static readonly BALANCED_CHAT = new ModelStrategy('balanced_chat');
  static readonly HIGH_REASONING = new ModelStrategy('high_reasoning');
  static readonly DETERMINISTIC = new ModelStrategy('deterministic');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to BALANCED_CHAT. */
  static resolve(value: unknown): ModelStrategy {
    if (value instanceof ModelStrategy) return value;
    const found = ModelStrategy.fromValue(String(value ?? '').trim());
    return (found as ModelStrategy | undefined) ?? ModelStrategy.BALANCED_CHAT;
  }
}
