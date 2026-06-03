export interface NewRoleFormData {
  slug: string;
  name: string;
  description: string;
  type: string;
  permissions: string[];
}

export interface NewRolePageState {
  loading: boolean;
  permissions: any[];
  formData: NewRoleFormData;
}
