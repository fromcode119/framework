import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';

export interface IDateTimePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showTime?: boolean;
  /** What the operator picks (and what onChange emits): instant, day, `YYYY-MM` month or `YYYY` year. */
  granularity?: DateTimePickerGranularity;
  placeholder?: string;
  className?: string;
  size?: FieldSize;
}
