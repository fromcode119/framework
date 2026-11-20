import copy from '@/app/kit/i18n/en.json';

/**
 * The kit's own words: its page titles, what each component is for, and the sample text its demos
 * show. The kit is the console's component reference, opened by address and read by whoever builds
 * a screen, so it is written in English, the language of the code samples printed beside it.
 */
export class KitCopy {
  /** `{name}` in the text is replaced by `values.name`. */
  static t(key: string, values: Record<string, string> = {}): string {
    const text = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], copy);
    return String(text ?? key).replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
  }
}
