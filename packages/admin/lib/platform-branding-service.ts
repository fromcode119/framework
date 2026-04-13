import { AppEnv } from './env';

export class PlatformBrandingService {
  static resolvePlatformName(settings?: Record<string, unknown> | null): string {
    const configuredName = String(settings?.platform_name ?? '').trim();
    return configuredName || AppEnv.APP_NAME;
  }
}