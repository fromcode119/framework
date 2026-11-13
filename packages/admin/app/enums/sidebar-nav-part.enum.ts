import { Enum } from '@fromcode119/react-class-components';

/**
 * Which part of the menu a list draws: the scrolling list of sections, or the foot pinned under it
 * (Settings and upkeep), which stays in reach however long the list is.
 */
export class SidebarNavPart extends Enum {
  static readonly MAIN = new SidebarNavPart('main');
  static readonly FOOT = new SidebarNavPart('foot');

  private constructor(value: string) {
    super(value);
  }
}
