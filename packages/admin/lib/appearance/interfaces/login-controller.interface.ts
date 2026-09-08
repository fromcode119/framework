import type { FormEvent } from 'react';
import type { TwoFactorMethod } from '@fromcode119/core/client';
import type { ILoginFieldErrors } from '@/app/login/interfaces/login-field-errors.interface';

/**
 * Everything an appearance needs to render a sign-in of its own design, and nothing that would let it
 * BE the sign-in.
 *
 * The appearance owns the markup — its layout, its panel, its illustration, its inputs, its button —
 * because no slot arrangement reaches the designs people actually want (icons inside the field,
 * underline inputs, a password-reveal eye). It gets the current values, the setters, and `submit`.
 *
 * It does NOT get anything that could manufacture a session. `submit` posts to the framework's own
 * `/auth/login`, which is what mints the httpOnly cookie; the 2FA challenge, the redirect after
 * success and the "session expired" purge stay on the page. `AppearanceSecurityGate` renders a frame
 * only for a visitor with NO session and only on an unauthenticated auth route, so a login override
 * can never stand in for the authenticated shell. The boundary is the server, where it belongs.
 */
export interface ILoginController {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;

  /** Posts the credentials. Safe to wire straight to a `<form onSubmit>` — it calls `preventDefault`. */
  submit: (event?: FormEvent) => void;
  /** Sends the visitor to the forgot-password route. */
  forgotPassword: () => void;
  /** The framework's own "contact support" action, so a custom design can keep offering it. */
  contactSupport: () => void;

  isLoading: boolean;
  /** The failure to show, already worded for a person. Empty when there is none. */
  error: string;
  fieldErrors: ILoginFieldErrors;

  /** True once the password was accepted and a second factor is being asked for. */
  requiresTwoFactor: boolean;
  twoFactorMethod: TwoFactorMethod;
  totpToken: string;
  recoveryCode: string;
  setTwoFactorMethod: (method: TwoFactorMethod) => void;
  setTotpToken: (value: string) => void;
  setRecoveryCode: (value: string) => void;

  /** The workspace this domain serves, from the PUBLIC host route. Empty on the shared admin host. */
  workspace: string;
  /** The words the framework would have used, for a design that wants them rather than its own. */
  title: string;
  subtitle: string;
}
