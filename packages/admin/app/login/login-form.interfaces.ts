import type { LoginFieldErrors } from './login-page.interfaces';

export interface LoginTwoFactorFieldsProps {
  twoFactorMethod: 'totp' | 'recovery';
  totpToken: string;
  recoveryCode: string;
  fieldErrors: LoginFieldErrors;
  onSelectMethod: (method: 'totp' | 'recovery') => void;
  onTotpTokenChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
}

export interface LoginFormProps {
  email: string;
  password: string;
  totpToken: string;
  recoveryCode: string;
  twoFactorMethod: 'totp' | 'recovery';
  requiresTwoFactor: boolean;
  isLoading: boolean;
  error: string;
  fieldErrors: LoginFieldErrors;
  onSubmit: (e: React.FormEvent) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onForgotPassword: (e: React.FormEvent) => void;
  onSelectTwoFactorMethod: (method: 'totp' | 'recovery') => void;
  onTotpTokenChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
}
