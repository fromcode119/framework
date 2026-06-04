export interface NewPermissionFormData {
  name: string;
  description: string;
  group: string;
  impact: string;
  pluginSlug: string;
}

export interface NewPermissionPageState {
  loading: boolean;
  formData: NewPermissionFormData;
}
