/**
 * Replace-instruction parsing helpers for the AI runtime classifier.
 * Extracted from ClassifierHelpers to keep files under the line limit.
 */
export class ClassifierReplaceHelpers {
  /**
   * Parse replace instruction from user message
   *
   * @param prompt - The user message
   * @returns Object with from and to strings, or null if not a replace instruction
   *
   * @example
   * const parsed = ClassifierReplaceHelpers.parseReplaceInstruction('change "old" to "new"');
   * // => { from: 'old', to: 'new' }
   */
  static parseReplaceInstruction(prompt: string): { from: string; to: string } | null {
    const sourceRaw = String(prompt || '').trim();
    if (!sourceRaw) return null;
    const source = sourceRaw.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();

    const patterns: RegExp[] = [
      /(?:change|replace|update|set|chage|chanege)[^%\n]{0,120}([+-]?\d+(?:\.\d+)?%)\b[\s\S]{0,80}?\bto\b\s*([+-]?\d+(?:\.\d+)?%)\b/i,
      /([+-]?\d+(?:\.\d+)?%)\s*(?:->|to)\s*([+-]?\d+(?:\.\d+)?%)\b/i,
      /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
      /update\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /chage\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /chanege\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s+(?:to|with)\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s*->\s*["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      const from = String(match?.[1] || '').trim();
      const to = String(match?.[2] || '').trim();
      if (from && to && from.toLowerCase() !== to.toLowerCase()) {
        return { from, to };
      }
    }

    const unquoted = source.match(
      /^(?:can you|could you|please)?\s*(?:change|chage|chanege|replace|update|rename|swap|substitute)\s+(.+?)\s+(?:with|to)\s+(.+?)\s*$/i,
    );
    if (unquoted) {
      const from = String(unquoted[1] || '')
        .trim()
        .replace(/^['"""'']+/, '')
        .replace(/['"""'']+$/, '')
        .trim();
      const to = String(unquoted[2] || '')
        .trim()
        .replace(/^['"""'']+/, '')
        .replace(/['"""'']+$/, '')
        .trim();
      if (from && to && from.toLowerCase() !== to.toLowerCase()) {
        return { from, to };
      }
    }

    return null;
  }

  /**
   * Find the latest replace instruction from conversation history
   *
   * @param history - Array of conversation messages
   * @returns Object with from and to strings, or null if not found
   *
   * @example
   * const latest = ClassifierReplaceHelpers.findLatestReplaceFromHistory(history);
   * // => { from: 'old', to: 'new' }
   */
  static findLatestReplaceFromHistory(
    history: Array<{ role?: string; content?: string }>,
  ): { from: string; to: string } | null {
    const source = Array.isArray(history) ? history : [];
    for (let i = source.length - 1; i >= 0; i -= 1) {
      const entry = source[i];
      if (String(entry?.role || '').toLowerCase() !== 'user') continue;
      const parsed = ClassifierReplaceHelpers.parseReplaceInstruction(String(entry?.content || ''));
      if (parsed) return parsed;
    }
    return null;
  }
}
