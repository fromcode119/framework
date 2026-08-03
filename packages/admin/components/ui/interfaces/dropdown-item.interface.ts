import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { ReactNode } from 'react';

export interface IDropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: DropdownItemVariant;
}
