import { CoreServices } from '@fromcode119/core/client';

/**
 * Utility class for tag field operations.
 * Handles collection candidate resolution, text formatting, and label inference.
 */
export class TagFieldUtils {
  /**
   * Resolves possible collection name variants for tag suggestions.
   * Handles legacy physical aliases and underscore/hyphen normalization.
   * 
   * @param collection - Collection name
   * @returns Array of possible collection name variants
   * 
   * @example
   * const variants = TagFieldUtils.resolveCollectionCandidates('@blog/posts');
   * // => ['@blog/posts', 'blog-posts', 'blog_posts', 'posts', ...]
   */
  static resolveCollectionCandidates(collection: string): string[] {
    return CoreServices.getInstance().collectionIdentity.buildReferenceCandidates(collection);
  }

  /**
   * Converts text to title case by capitalizing first letter of each word.
   * 
   * @param input - Text to convert
   * @returns Title-cased text
   * 
   * @example
   * const title = TagFieldUtils.toTitleCase('hello_world'); // "Hello World"
   * const camel = TagFieldUtils.toTitleCase('helloWorld'); // "Hello World"
   */
  static toTitleCase(input: string): string {
    return input
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Infers a human-readable label from a field name.
   * 
   * @param fieldName - Field name (e.g., 'user_email')
   * @returns Inferred label (e.g., 'User Email')
   * 
   * @example
   * const label = TagFieldUtils.inferFieldLabel('user_email'); // "User Email"
   * const fallback = TagFieldUtils.inferFieldLabel(); // "Value"
   */
  static inferFieldLabel(fieldName?: string): string {
    const normalized = String(fieldName || '').trim();
    if (!normalized) return 'Value';
    return TagFieldUtils.toTitleCase(normalized);
  }
}
