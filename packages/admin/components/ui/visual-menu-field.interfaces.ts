import type React from 'react';

export interface VisualMenuFieldProps {
  field: any;
  value: any[];
  onChange: (value: any[]) => void;
  theme?: string;
  collectionSlug: string;
}

export interface VisualMenuItemProps {
  field: any;
  item: any;
  index: number;
  theme?: string;
  renderFieldInput: (f: any, item: any, index: number) => React.ReactNode;
  onIndent: (index: number, direction: 'left' | 'right') => void;
  onRemove: (index: number) => void;
}

export interface VisualMenuFieldInputProps {
  field: any;
  item: any;
  index: number;
  theme?: string;
  collectionSlug: string;
  onUpdateItem: (index: number, name: string, val: any) => void;
}
