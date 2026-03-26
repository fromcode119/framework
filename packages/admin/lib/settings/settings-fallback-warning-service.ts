export class SettingsFallbackWarningService {
  private static readonly warnedScopes = new Set<string>();

  static warnOnce(scope: string, message: string): void {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const normalizedScope = String(scope || '').trim();
    if (!normalizedScope || SettingsFallbackWarningService.warnedScopes.has(normalizedScope)) {
      return;
    }

    SettingsFallbackWarningService.warnedScopes.add(normalizedScope);
    console.warn(message);
  }
}
