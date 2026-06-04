export interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[]>>;
}

export interface LoginFieldErrors {
  email?: string;
  password?: string;
  totpToken?: string;
  recoveryCode?: string;
}

export interface LoginPageState {
  isLoading: boolean;
  isCheckingStatus: boolean;
  email: string;
  password: string;
  totpToken: string;
  recoveryCode: string;
  twoFactorMethod: 'totp' | 'recovery';
  requiresTwoFactor: boolean;
  error: string;
  fieldErrors: LoginFieldErrors;
}
