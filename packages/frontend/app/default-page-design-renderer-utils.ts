export class DefaultPageDesignRendererUtils {
  static resolvePageTargetKey(entry: unknown): string {
    const value = entry as Record<string, unknown> | null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '';
    }

    return String(value.recipe || '').trim();
  }
}