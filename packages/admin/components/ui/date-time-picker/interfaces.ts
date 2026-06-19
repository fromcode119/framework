import type React from 'react';

export interface DateTimePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showTime?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface DateTimePickerCoords {
  top: number;
  left: number;
  width: number;
}

export interface DateTimePickerState {
  isOpen: boolean;
  coords: DateTimePickerCoords;
  visibleMonth: Date;
  isJumpViewOpen: boolean;
}

export interface DateTimePickerPopoverProps {
  theme: string;
  showTime: boolean;
  timezone: string;
  placeholder: string;
  value?: string;
  coords: DateTimePickerCoords;
  visibleMonth: Date;
  isJumpViewOpen: boolean;
  utcDate: Date | null;
  zonedParts: any;
  pickerDate?: Date;
  popoverRef: React.RefObject<HTMLDivElement>;
  onJumpToSelected: () => void;
  onShiftMonth: (offset: number) => void;
  onToggleJumpView: () => void;
  onShiftYear: (offset: number) => void;
  onJumpMonthSelect: (monthIndex: number) => void;
  onSelect: (date: Date | undefined) => void;
  onVisibleMonthChange: (next: Date) => void;
  onTimeChange: (type: 'hours' | 'minutes', val: string) => void;
  onQuickAction: (dayOffset: number) => void;
  onClear: () => void;
  onClose: () => void;
}
