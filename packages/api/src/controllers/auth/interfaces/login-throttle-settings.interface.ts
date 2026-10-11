export interface ILoginThrottleSettings {
  threshold: number;
  windowMinutes: number;
  lockoutMinutes: number;
  captchaEnabled: boolean;
  captchaThreshold: number;
  /** Failed logins from one address, across every account, before that address is locked out. */
  addressThreshold?: number;
  /** Password-reset emails one account, or one address, may ask for within the window. */
  passwordResetLimit?: number;
}
