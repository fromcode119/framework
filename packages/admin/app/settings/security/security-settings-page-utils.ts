export class SecuritySettingsPageUtils {
  static bytesToMB(value?: number | null): string {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    return (value / (1024 * 1024)).toFixed(2);
  }
}