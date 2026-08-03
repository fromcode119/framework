
/**
 * Utilities for reading and processing URL query parameters.
 */
export class QueryParamUtils {
  /**
   * Resolve a potentially promised Record<string, string | string[] | undefined> object.
   */
  static async resolveSearchParams(searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>)): Promise<Record<string, string | string[] | undefined> | undefined> {
    if (!searchParams) return undefined;
    return await searchParams;
  }

  /**
   * Read a single string value from search params.
   * If the value is an array, returns the first element.
   */
  static readSearchValue(searchParams: Record<string, string | string[] | undefined> | undefined, key: string): string {
    const value = searchParams?.[key];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }

  /**
   * Check if preview mode is enabled via ?preview=1 query parameter.
   */
  static isPreviewMode(searchParams: Record<string, string | string[] | undefined> | undefined): boolean {
    const preview = searchParams?.preview;
    const previewEnabled = preview === '1' || (Array.isArray(preview) && preview.includes('1'));
    return previewEnabled;
  }
}
