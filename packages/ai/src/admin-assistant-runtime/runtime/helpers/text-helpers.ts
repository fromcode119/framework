/**
 * Text manipulation utilities for AI runtime
 * Consolidates string operations used across classifier, action-builder, workspace-map
 */
export class TextHelpers {
  /**
   * Escape special regex characters in a string
   * 
   * @param text - The string to escape
   * @returns Escaped string safe for use in RegExp constructor
   * 
   * @example
   * const escaped = TextHelpers.escapeRegExp('.*+?^${}()|[]\\');
   * // => "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\"
   * const pattern = new RegExp(escaped); // Safe to use
   */
  static escapeRegExp(text: string): string {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Normalize text to lowercase trimmed string
   * Used for case-insensitive comparisons
   * 
   * @param value - The string to normalize
   * @returns Lowercase trimmed string
   * 
   * @example
   * const normalized = TextHelpers.normalize('  Hello World  ');
   * // => "hello world"
   */
  static normalize(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  /**
   * Normalize text to token format (lowercase, hyphens, no spaces)
   * Used for generating slug-like identifiers
   * 
   * @param value - The string to tokenize
   * @returns Token-formatted string
   * 
   * @example
   * const token = TextHelpers.normalizeToken('Hello_World Test');
   * // => "hello-world-test"
   */
  static normalizeToken(value: string): string {
    return String(value || '').trim().replace(/[\s_-]+/g, '-').toLowerCase();
  }
}
