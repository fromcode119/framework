export class AutocompleteOptionService {
  static async loadOptions<T>(
    loader: () => Promise<T[]>,
    query: string,
    getLabel: (option: T) => string,
  ): Promise<{ options: T[]; matched: T | null }> {
    const options = await loader();
    return {
      options,
      matched: AutocompleteOptionService.findLabelMatch(options, query, getLabel),
    };
  }

  static findLabelMatch<T>(options: T[], value: string, getLabel: (option: T) => string): T | null {
    const normalizedValue = AutocompleteOptionService.normalizeLookupValue(value);
    if (!normalizedValue) {
      return null;
    }

    return options.find((option) => (
      AutocompleteOptionService.normalizeLookupValue(getLabel(option)) === normalizedValue
    )) || null;
  }

  private static normalizeLookupValue(value: string): string {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
}