import { Enum } from '@fromcode119/reactor';

/** How important a context message is when trimming to fit the window. */
export class MessageImportance extends Enum {
  static readonly CRITICAL = new MessageImportance('CRITICAL');
  static readonly HIGH = new MessageImportance('HIGH');
  static readonly MEDIUM = new MessageImportance('MEDIUM');
  static readonly LOW = new MessageImportance('LOW');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to CRITICAL. */
  static resolve(value: unknown): MessageImportance {
    if (value instanceof MessageImportance) return value;
    const found = MessageImportance.fromValue(String(value ?? '').trim());
    return (found as unknown as MessageImportance | undefined) ?? MessageImportance.CRITICAL;
  }
}
