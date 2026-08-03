import { Enum } from '@fromcode119/reactor';

/** Whether a collection holds many records, one global, or a singleton. */
export class CollectionKind extends Enum {
  static readonly LIST = new CollectionKind('list');
  static readonly GLOBAL = new CollectionKind('global');
  static readonly SINGLETON = new CollectionKind('singleton');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to LIST. */
  static resolve(value: unknown): CollectionKind {
    if (value instanceof CollectionKind) return value;
    const found = CollectionKind.fromValue(String(value ?? '').trim());
    return (found as CollectionKind | undefined) ?? CollectionKind.LIST;
  }
}
