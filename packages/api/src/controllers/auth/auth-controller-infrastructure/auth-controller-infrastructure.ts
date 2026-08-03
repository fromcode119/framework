import { AuthControllerCookieInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-cookie-infrastructure';

export class AuthControllerInfrastructure extends AuthControllerCookieInfrastructure {
  protected async getSettingNumber(_key: string, defaultValue: number, _min: number, _max: number): Promise<number> {
    return defaultValue;
  }
}
