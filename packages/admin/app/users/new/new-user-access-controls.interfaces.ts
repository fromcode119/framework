import type { NewUserFormData } from './new-user-page.interfaces';

export interface NewUserAccessControlsProps {
  formData: NewUserFormData;
  onPatch: (patch: Partial<NewUserFormData>) => void;
}
