import { BaseService } from './base-service';

/**
 * Content Service.
 * 
 * Provides utilities for content extraction, parsing, and manipulation.
 * 
 * @example
 * ```typescript
 * import { CoreServices } from '@fromcode119/core';
 * 
 * const services = CoreServices.getInstance();
 * const text = services.content.extractText(blockEditorContent);
 * const attrs = services.content.parseAttributes('source="content" limit=5');
 * ```
 */
export class ContentService extends BaseService {
  get serviceName(): string {
    return 'ContentService';
  }

  /**
   * Best-effort text extraction that works with strings and block editor payloads.
   * 
   * Supports:
   * - Plain strings
   * - Block editor arrays with content/text properties
   * - Rich text blocks with nested children
   * 
   * @param content - String or block editor payload
   * @returns Extracted plain text
   */
  extractText(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    return content
      .map((block: any) => {
        if (!block) return '';
        if (typeof block === 'string') return block;
        if (block.content && typeof block.content === 'string') return block.content;
        if (block.text && typeof block.text === 'string') return block.text;
        
        // Rich text blocks may nest children with text
        if (Array.isArray(block.children)) {
          return block.children
            .map((child: any) => (child && typeof child.text === 'string' ? child.text : ''))
            .join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Recursively collects all strings from an object or array.
   * Includes strings found nested inside JSON strings.
   * 
   * @param input - Object, array, or string (possibly JSON)
   * @returns Flat array of all string values found
   */
  collectStrings(input: any): string[] {
    if (typeof input === 'string') {
      if (!this.looksLikeJson(input)) return [input];
      try {
        return this.collectStrings(JSON.parse(input));
      } catch {
        return [input];
      }
    }
    if (!input || typeof input !== 'object') return [];
    
    return Object.values(input).flatMap((value) => this.collectStrings(value));
  }

  /**
   * Checks if a string looks like JSON (starts with { or [).
   */
  looksLikeJson(value: string): boolean {
    const trimmed = value.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }

  /**
   * Parses shortcode-style attributes from a string.
   * 
   * @example
   * parseAttributes('source="content" limit=5')
   * // => { source: "content", limit: "5" }
   * 
   * @param raw - Attribute string
   * @returns Parsed key-value pairs
   */
  parseAttributes(raw: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const pattern = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\]]+))/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(raw)) !== null) {
      const [, key, doubleQuoted, singleQuoted, bare] = match;
      attributes[key] = String(doubleQuoted ?? singleQuoted ?? bare ?? '');
    }

    return attributes;
  }

  /**
   * Sanitizes a key (tag, slug, etc.) to be alphanumeric with dashes and underscores.
   * 
   * @param key - Raw key string
   * @returns Sanitized lowercase key
   */
  sanitizeKey(key: string): string {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
  }
}
