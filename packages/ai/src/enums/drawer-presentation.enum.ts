import { Enum } from '@fromcode119/reactor';

/** How the assistant drawer is presented. */
export class DrawerPresentation extends Enum {
  static readonly DOCKED = new DrawerPresentation('docked');
  static readonly OVERLAY = new DrawerPresentation('overlay');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to DOCKED. */
  static resolve(value: unknown): DrawerPresentation {
    if (value instanceof DrawerPresentation) return value;
    const found = DrawerPresentation.fromValue(String(value ?? '').trim());
    return (found as unknown as DrawerPresentation | undefined) ?? DrawerPresentation.DOCKED;
  }
}
