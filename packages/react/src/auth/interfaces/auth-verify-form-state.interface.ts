import type { AuthVerifyStatus } from '@react/auth/enums/auth-verify-status.enum';

export interface IAuthVerifyFormState {
  status: AuthVerifyStatus;
  error: string;
  email: string;
  resending: boolean;
  resendNotice: string;
  resendError: string;
}
