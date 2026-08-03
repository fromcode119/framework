export interface IAuthRegisterFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  verificationPending: boolean;
}
