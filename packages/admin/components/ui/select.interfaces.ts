import type React from 'react';

export interface Option {
  label: string;
  value: string;
  group?: string;
  section?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  theme?: string;
  className?: string;
  triggerClassName?: string;
  label?: string;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSearchChange?: (value: string) => void;
  clearable?: boolean;
}

export interface SelectState {
  isOpen: boolean;
  searchValue: string;
  coords: { top: number; left: number; width: number };
}

export interface SelectOptionGroup {
  name: string;
  options: Option[];
}

export interface SelectMenuProps {
  theme: string;
  searchable: boolean;
  searchValue: string;
  coords: { top: number; left: number; width: number };
  filteredOptions: Option[];
  groupedFilteredOptions: SelectOptionGroup[];
  showGroupHeaders: boolean;
  selectedOption?: Option;
  menuRef: React.RefObject<HTMLDivElement>;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}
