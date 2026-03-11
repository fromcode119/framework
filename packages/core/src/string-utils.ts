/**
 * String manipulation utilities.
 *
 * @example
 * StringUtils.slugify("Hello World!")       // "hello-world"
 * StringUtils.escapeHtml("<script>alert()") // "&lt;script&gt;alert()"
 * StringUtils.parseCsv("1,2,3")             // ["1", "2", "3"]
 */
export class StringUtils {
  /**
   * Convert text to a URL-safe slug.
   * Strips accents, lowercases, replaces whitespace/special chars with hyphens.
   */
  static slugify(text: unknown, fallback = 'item'): string {
    const slug = String(text ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || fallback;
  }

  /** Escape HTML special characters to prevent XSS. */
  static escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Parse a comma/semicolon/newline-separated string into a deduplicated array.
   */
  static parseCsv(value: unknown, fallback: string[] = []): string[] {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    const items = raw.split(/[,\n;]/g).map((item) => item.trim()).filter(Boolean);
    return items.length ? Array.from(new Set(items)) : fallback;
  }
}