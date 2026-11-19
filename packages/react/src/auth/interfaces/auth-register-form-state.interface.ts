export interface IAuthRegisterFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  verificationPending: boolean;
  /** The account exists but its confirmation email did not leave: the page must say so, not "check your inbox". */
  emailNotSent: boolean;
  resending: boolean;
  resendError: string;
}
