export class AssistantToolingTextHelpers {
  static isPotentialLocaleKey(key: string): boolean {
    return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(key || '').trim());
  }

  static tokenVariants(token: string): string[] {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return [];
    const variants = new Set<string>([normalized]);
    if (normalized.endsWith('s') && normalized.length > 3) {
      variants.add(normalized.slice(0, -1));
    } else if (!normalized.endsWith('s') && normalized.length > 3) {
      variants.add(`${normalized}s`);
    }
    return Array.from(variants);
  }

  static textMatchesQuery(
    value: string,
    queryLower: string,
    queryTokens: string[],
    normalizeSearchText: (value: string) => string,
  ): boolean {
    const normalized = normalizeSearchText(value);
    if (!normalized) return false;
    if (queryLower && normalized.includes(queryLower)) return true;
    if (!queryTokens.length) return false;
    return queryTokens.every((token) =>
      this.tokenVariants(token).some((variant) => normalized.includes(variant)),
    );
  }
}
