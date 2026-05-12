import { ApplicationUrlUtils } from './application-url-utils';

export class ApplicationHostUtils {
  static readonly LOCALHOST_ORIGIN = 'http://localhost';
  static readonly LOCAL_ALLOWED_DOMAINS: readonly string[] = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

  static normalizeHostname(value: unknown): string {
    const parsed = value instanceof URL ? value : ApplicationUrlUtils.parseAbsoluteUrl(value);
    if (parsed) {
      return ApplicationHostUtils.stripIpv6Brackets(String(parsed.hostname || '').trim().toLowerCase());
    }

    const rawValue = String(value ?? '').trim().toLowerCase();
    if (!rawValue) {
      return '';
    }

    const firstValue = rawValue.split(',')[0].trim();
    if (!firstValue) {
      return '';
    }

    if (firstValue.startsWith('[')) {
      const closingBracketIndex = firstValue.indexOf(']');
      return closingBracketIndex >= 0 ? firstValue.slice(1, closingBracketIndex) : firstValue;
    }

    if (firstValue.includes(':') && firstValue.indexOf(':') !== firstValue.lastIndexOf(':')) {
      return firstValue;
    }

    const colonIndex = firstValue.indexOf(':');
    return colonIndex >= 0 ? firstValue.slice(0, colonIndex) : firstValue;
  }

  static isLoopbackHostname(value: unknown): boolean {
    const hostname = ApplicationHostUtils.normalizeHostname(value);
    return ApplicationHostUtils.LOCAL_ALLOWED_DOMAINS.includes(hostname)
      || hostname.startsWith('127.');
  }

  static isLocalDevelopmentHostname(value: unknown): boolean {
    const hostname = ApplicationHostUtils.normalizeHostname(value);
    if (!hostname) {
      return false;
    }

    return ApplicationHostUtils.isLoopbackHostname(hostname)
      || hostname === ApplicationUrlUtils.LEGACY_PLATFORM_DOMAIN
      || hostname.endsWith(`.${ApplicationUrlUtils.LEGACY_PLATFORM_DOMAIN}`);
  }

  static getLocalAllowedDomains(): string[] {
    return [...ApplicationHostUtils.LOCAL_ALLOWED_DOMAINS];
  }

  private static stripIpv6Brackets(value: string): string {
    if (!value.startsWith('[') || !value.endsWith(']')) {
      return value;
    }

    return value.slice(1, -1);
  }
}
