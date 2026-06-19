export interface MediaRelationFieldProps {
  value: any;
  onChange: (val: any) => void;
  theme: string;
  hasMany?: boolean;
}

export interface MediaRelationPreview {
  url?: string;
  filename?: string;
}

export interface MediaRelationFieldState {
  open: boolean;
  preview: MediaRelationPreview | null;
}

export interface MediaRelationFieldViewProps {
  theme: string;
  hasMany: boolean;
  open: boolean;
  preview: MediaRelationPreview | null;
  selectedIds: Array<string | number>;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: any) => void;
}
