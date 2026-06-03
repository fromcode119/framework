export interface EditRolePageProps {
  params: Promise<{ slug: string }>;
}

export interface EditRoleFormData {
  slug: string;
  name: string;
  description: string;
  type: string;
  permissions: string[];
}

export interface EditRolePageState {
  roleSlug: string;
  loading: boolean;
  fetching: boolean;
  permissions: any[];
  formData: EditRoleFormData;
}
