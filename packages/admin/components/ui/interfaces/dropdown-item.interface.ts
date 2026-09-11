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
  /** Secondary line under the label, for items whose identity needs more than a name. */
  detail?: string;
}
