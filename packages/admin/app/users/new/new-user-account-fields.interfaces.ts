import type { NewUserFormData } from './new-user-page.interfaces';

export interface NewUserAccountFieldsProps {
  formData: NewUserFormData;
  errors: Record<string, string>;
  onPatch: (patch: Partial<NewUserFormData>) => void;
}
