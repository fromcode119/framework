import { Enum } from '@fromcode119/react-class-components';

/**
 * Where a dropdown's panel sits relative to its trigger.
 *
 * `STACKED` is the default everywhere: above or below, whichever fits. `BESIDE` is for a trigger
 * pinned to the edge of a rail — the sidebar account card — where opening upward covers the
 * navigation the menu belongs to, and opening alongside leaves it visible.
 */
export class DropdownPlacement extends Enum {
  static readonly STACKED = new DropdownPlacement('stacked');
  static readonly BESIDE = new DropdownPlacement('beside');

  private constructor(value: string) {
    super(value);
  }
}
