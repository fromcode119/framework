import { DropdownDirection } from '@/components/ui/enums/dropdown-direction.enum';

export interface IDropdownCoords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  direction: DropdownDirection;
}
