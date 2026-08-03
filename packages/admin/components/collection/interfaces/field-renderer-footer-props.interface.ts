import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export interface IFieldRendererFooterProps {
  field: ICollectionField;
  resolvedFieldDescription: string;
  errors?: string[];
}
