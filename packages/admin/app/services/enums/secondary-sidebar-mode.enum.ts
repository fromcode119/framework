import { Enum } from '@fromcode119/reactor';

/** Layout mode of the secondary sidebar (viewport-derived, never persisted). */
export class SecondarySidebarMode extends Enum {
  static readonly DESKTOP = new SecondarySidebarMode('desktop');
  static readonly MOBILE = new SecondarySidebarMode('mobile');
  static readonly MINIMAL = new SecondarySidebarMode('minimal');

  private constructor(value: string) {
    super(value);
  }
}
