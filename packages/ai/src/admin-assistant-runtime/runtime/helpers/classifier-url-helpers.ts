/**
 * URL-hint and arithmetic helpers for the AI runtime classifier.
 * Extracted from ClassifierHelpers to keep files under the line limit.
 */
export class ClassifierUrlHelpers {
  /**
   * Find URL hint in user message
   *
   * @param value - The user message
   * @returns URL or path string if found
   */
  static findUrlHint(value: string): string | undefined {
    const match = String(value || '').match(/https?:\/\/[^\s)]+/i);
    if (match?.[0]) return match[0];
    const pathMatch = String(value || '').match(/\/(?:examples|preview|pages)\/[a-z0-9\-_\/]+/i);
    return pathMatch?.[0] || undefined;
  }

  /**
   * Normalize arithmetic expressions for evaluation
   *
   * @param value - The arithmetic prompt
   * @returns Normalized expression string
   */
  static normalizeArithmeticPrompt(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/\bplus\b/g, '+')
      .replace(/\bminus\b/g, '-')
      .replace(/\b(times|multiplied by|x)\b/g, '*')
      .replace(/\b(divided by|over)\b/g, '/')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Try to evaluate a math expression from user prompt
   *
   * @param prompt - The user's arithmetic question
   * @returns Evaluated result as string, or null if not a valid math expression
   */
  static tryEvalMathExpression(prompt: string): string | null {
    const normalized = ClassifierUrlHelpers.normalizeArithmeticPrompt(prompt);
    const match = normalized.match(
      /^(?:what(?:'s| is)?|calculate|compute|solve)?\s*\(?\s*([\-+]?\d+(?:\.\d+)?(?:\s*[\+\-\*\/]\s*[\-+]?\d+(?:\.\d+)?)+)\s*\)?\s*\??$/,
    );
    const expression = String(match?.[1] || '').trim();
    if (!expression) return null;
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) return null;
    try {
      // Expression is tightly sanitized to digits/operators/whitespace.
      const value = Function(`"use strict"; return (${expression});`)();
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      const rounded = Math.round(value * 1_000_000) / 1_000_000;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    } catch {
      return null;
    }
  }
}
