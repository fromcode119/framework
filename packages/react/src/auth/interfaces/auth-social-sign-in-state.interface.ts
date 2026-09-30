import type { AuthSocialProvider } from '@react/auth/auth-social-provider';

export interface IAuthSocialSignInState {
  providers: AuthSocialProvider[];
  /** The `?ssoError=` code a refused social sign-in came back with. */
  error: string;
}
