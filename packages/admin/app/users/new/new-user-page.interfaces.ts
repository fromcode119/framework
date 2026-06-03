export interface NewUserFormData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  accountStatus: string;
  forcePasswordReset: boolean;
  password: string;
  confirmPassword: string;
  roles: string[];
}

export interface NewUserPageState {
  saving: boolean;
  loadingRoles: boolean;
  roles: any[];
  formData: NewUserFormData;
  errors: Record<string, string>;
}
