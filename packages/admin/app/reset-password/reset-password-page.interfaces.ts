export interface ResetPasswordPageState {
  token: string;
  newPassword: string;
  confirmPassword: string;
  isLoading: boolean;
  error: string;
  message: string;
}
