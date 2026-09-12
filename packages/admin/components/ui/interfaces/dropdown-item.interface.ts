import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { ReactNode } from 'react';

export interface IDropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: DropdownItemVariant;
  /**
   * A heading rendered above this item, starting a group. Set it on the FIRST item of the group
   * only; repeating it on every item would print the heading over and over.
   */
  section?: string;
  /** Renders the item as the current choice of its group — a site you are already inside. */
  selected?: boolean;
  /**
   * Marks the item as one option among several, so it carries a radio whether or not it is the
   * chosen one. Without it a lone unselected row would show nothing and read as an action.
   */
  selectable?: boolean;
  /** Secondary line under the label, for items whose identity needs more than a name. */
  detail?: string;
  /**
   * Set with `section` to bound that group in its own scrolling box.
   *
   * For a group that grows with the installation — the list of sites — so the menu stops growing
   * with it. Without this the whole menu scrolls as one, and on a deployment with nine sites the
   * actions that matter (Add a site, Sign out) were pushed below the fold of their own menu.
   */
  scrolls?: boolean;
}
