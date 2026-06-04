export interface SetupPageFieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface SetupPageState {
  isLoading: boolean;
  isChecking: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  error: string;
  fieldErrors: SetupPageFieldErrors;
}
