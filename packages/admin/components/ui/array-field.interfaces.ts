import type React from 'react';

export interface ArrayFieldProps {
  field: any;
  value: any[];
  onChange: (value: any[]) => void;
  theme?: string;
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  fieldComponents?: Record<string, any>;
}

export interface ArrayFieldState {
  draggedIndex: number | null;
  isHandleHovered: number | null;
}

export interface ArrayFieldRowProps {
  field: any;
  item: any;
  index: number;
  theme?: string;
  itemsLength: number;
  draggedIndex: number | null;
  isHandleHovered: number | null;
  renderField: (f: any, item: any, index: number) => React.ReactNode;
  onSetDragged: (index: number | null) => void;
  onSetHandleHovered: (index: number | null) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
}

export interface ArrayFieldRowRendererProps {
  field: any;
  item: any;
  index: number;
  theme?: string;
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  fieldComponents?: Record<string, any>;
  items: any[];
  onUpdateItem: (index: number, name: string, val: any) => void;
  onChange: (value: any[]) => void;
}
