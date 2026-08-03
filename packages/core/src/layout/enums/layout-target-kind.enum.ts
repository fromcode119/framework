import { Enum } from '@fromcode119/reactor';

/** What a layout override targets. */
export class LayoutTargetKind extends Enum {
  static readonly PAGE = new LayoutTargetKind('page');
  static readonly BLOCK = new LayoutTargetKind('block');
  static readonly SLOT = new LayoutTargetKind('slot');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to PAGE. */
  static resolve(value: unknown): LayoutTargetKind {
    if (value instanceof LayoutTargetKind) return value;
    const found = LayoutTargetKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as LayoutTargetKind | undefined) ?? LayoutTargetKind.PAGE;
  }
}
