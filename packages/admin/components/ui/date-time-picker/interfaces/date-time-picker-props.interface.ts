import { FieldSize } from '@/components/ui/enums/field-size.enum';

export interface IDateTimePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showTime?: boolean;
  placeholder?: string;
  className?: string;
  size?: FieldSize;
}
