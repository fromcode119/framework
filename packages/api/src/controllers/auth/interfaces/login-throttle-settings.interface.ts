export interface ILoginThrottleSettings {
  threshold: number;
  windowMinutes: number;
  lockoutMinutes: number;
  captchaEnabled: boolean;
  captchaThreshold: number;
}
