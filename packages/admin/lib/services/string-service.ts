import { BaseService } from './base-service';
import { StringUtils } from '@fromcode119/sdk';

/**
 * Service for string manipulation and processing.
 * 
 * Handles:
 * - Capitalization and case conversion
 * - String normalization and sanitization
 * - Slugification
 * - Truncation
 */
export class StringService extends BaseService {
  /**
   * Capitalize first letter of a string.
   * 
   * @example
   * capitalize('hello') // "Hello"
   * capitalize('HELLO') // "HELLO"
   */
  capitalize(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Normalize and sanitize string input (trim whitespace).
   * 
   * @example
   * normalizeString('  hello  ') // "hello"
   * normalizeString(null) // ""
   */
  normalizeString(value: any): string {
    return String(value || '').trim();
  }

  /**
   * Normalize string and convert to lowercase.
   * 
   * @example
   * normalizeStringLower('  Hello World  ') // "hello world"
   */
  normalizeStringLower(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  /**
   * Convert string to URL-friendly slug.
   * 
   * @example
   * slugify('Hello World!') // "hello-world"
   * slugify('Café Münchën') // "cafe-munchen"
   */
  slugify(text: string): string {
    return StringUtils.slugify(text);
  }

  /**
   * Truncate string to specified length with ellipsis.
   * 
   * @example
   * truncate('Hello World', 8) // "Hello..."
   * truncate('Short', 10) // "Short"
   */
  truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Convert string to title case.
   * 
   * @example
   * toTitleCase('hello world') // "Hello World"
   * toTitleCase('API response') // "API Response"
   */
  toTitleCase(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => this.capitalize(word))
      .join(' ');
  }

  /**
   * Convert camelCase or PascalCase to human-readable text.
   * 
   * @example
   * camelToHuman('firstName') // "First Name"
   * camelToHuman('userAPIKey') // "User API Key"
   */
  camelToHuman(text: string): string {
    if (!text) return '';
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Strip HTML tags from string.
   * 
   * @example
   * stripHtml('<p>Hello <b>World</b></p>') // "Hello World"
   */
  stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Extract excerpt from text (first N characters, break at word boundary).
   * 
   * @example
   * excerpt('Hello world this is a test', 15) // "Hello world..."
   */
  excerpt(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > 0) {
      return truncated.slice(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
}