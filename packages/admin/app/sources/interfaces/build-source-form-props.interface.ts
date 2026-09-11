import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';

export interface IBuildSourceFormProps {
  build: any | null;
  busy: boolean;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSubmit: (values: IBuildSourceFormValues) => void;
}
