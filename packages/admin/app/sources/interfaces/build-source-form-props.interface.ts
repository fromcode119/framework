import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';
import type { SourceEditorMode } from '@/app/sources/enums/source-editor-mode.enum';

export interface IBuildSourceFormProps {
  build: any | null;
  busy: boolean;
  mode: SourceEditorMode;
  onCancel: () => void;
  onSubmit: (values: IBuildSourceFormValues) => void;
}
