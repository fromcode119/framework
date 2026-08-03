/** Interface definitions for AuthController */

export interface IPasswordPolicySettings {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  historyCount: number;
  breachCheck: boolean;
}
