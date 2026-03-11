export class IntegrationsPageUtils {
  static normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }

  static isBlank(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }
}