import { Enum } from '@fromcode119/reactor';

/** Which side overlay the assistant sidebar shows. */
export class SidebarOverlay extends Enum {
  static readonly NONE = new SidebarOverlay('none');
  static readonly LEFT = new SidebarOverlay('left');
  static readonly RIGHT = new SidebarOverlay('right');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to NONE. */
  static resolve(value: unknown): SidebarOverlay {
    if (value instanceof SidebarOverlay) return value;
    const found = SidebarOverlay.fromValue(String(value ?? '').trim());
    return (found as unknown as SidebarOverlay | undefined) ?? SidebarOverlay.NONE;
  }
}
