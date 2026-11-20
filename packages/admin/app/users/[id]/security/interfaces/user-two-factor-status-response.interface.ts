export interface IUserTwoFactorStatusResponse {
  enabled?: boolean;
  recoveryCodesRemaining?: number;
  /** Whether a new setup is allowed — off when the platform's two-factor switch is off. */
  enrollmentAllowed?: boolean;
}
