export interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export interface EditUserFormData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  accountStatus: string;
  forcePasswordReset: boolean;
  password: string;
  confirmPassword: string;
}

export interface EditUserPageState {
  routeId: string;
  loading: boolean;
  saving: boolean;
  formData: EditUserFormData;
  errors: Record<string, string>;
}
