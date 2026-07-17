import type { SsrShellValueSpec } from './ssr-shell-theme-template.types';

/**
 * Generic dotted-path resolver for theme-declared SSR shell tokens/lists.
 *
 * The framework knows NOTHING about what the theme's content fields are called —
 * the theme declares WHERE its values live (`theme.json` → `ui.ssrShell`) and this
 * resolver walks that path over a framework-owned source (the resolved document,
 * site settings, or a prefetch payload).
 *
 * Path grammar (deliberately tiny):
 *  - `a.b.c`   — object keys
 *  - `items.0` — array index
 *  - `a.*.b`   — WILDCARD: the first array element whose REMAINING path resolves to
 *                a non-empty value.
 *
 * A spec may also pair a wildcard-terminated path with `pick` — alternative paths
 * INSIDE the matched element (`path: 'content.*'`, `pick: ['name', 'data.name']`).
 * The element is chosen first (the first one where ANY pick resolves), then the first
 * resolving pick is returned. That ordering is what keeps sibling tokens reading from
 * the SAME element instead of drifting apart across a document.
 *
 * Together these replace the framework's old "first meaningful block" heuristic: the
 * theme states exactly where its content lives, so the framework never guesses at key
 * names.
 *
 * Locale maps are unwrapped at every step (`{ bg: [...] }` → `[...]`) — locales are a
 * framework concept, unlike the field names inside them. A map is only treated as a
 * locale map when it does not own the step key AND every key looks like a locale code.
 */
export class SsrShellPathResolver {
  private static readonly WILDCARD = '*';
  private static readonly LOCALE_KEY_RE = /^[a-z]{2}(?:[-_][A-Za-z0-9]+)*$/;

  /** First non-empty resolution across a spec's ordered candidate paths. */
  static resolveSpec(root: unknown, spec: SsrShellValueSpec, locale: string): string {
    const picks = Array.isArray(spec?.pick) ? spec.pick : [];
    for (const path of Array.isArray(spec?.paths) ? spec.paths : []) {
      const value = picks.length
        ? SsrShellPathResolver.resolvePicked(root, path, picks, locale)
        : SsrShellPathResolver.resolveText(root, path, locale);
      if (value) return value;
    }
    return '';
  }

  /**
   * `path` must end in the wildcard. Element-outer, pick-inner: the first element for
   * which any pick resolves wins, and that element's first resolving pick is returned.
   */
  private static resolvePicked(root: unknown, path: string, picks: string[], locale: string): string {
    const steps = SsrShellPathResolver.steps(path);
    if (steps[steps.length - 1] !== SsrShellPathResolver.WILDCARD) {
      return SsrShellPathResolver.resolveText(root, path, locale);
    }
    const parent = SsrShellPathResolver.walk(root, steps.slice(0, -1), locale);
    const rows = SsrShellPathResolver.unwrapLocale(parent, SsrShellPathResolver.WILDCARD, locale);
    if (!Array.isArray(rows)) return '';
    for (const row of rows) {
      for (const pick of picks) {
        const value = SsrShellPathResolver.resolveText(row, pick, locale);
        if (value) return value;
      }
    }
    return '';
  }

  /** Scalar (string/number, locale-map aware) at `path`, or ''. */
  static resolveText(root: unknown, path: string, locale: string): string {
    return SsrShellPathResolver.readText(SsrShellPathResolver.resolveNode(root, path, locale), locale);
  }

  /** Raw node at `path` — used for list roots, where the value is an array. */
  static resolveNode(root: unknown, path: string, locale: string): unknown {
    return SsrShellPathResolver.walk(root, SsrShellPathResolver.steps(path), locale);
  }

  /** First path that resolves to a non-empty array. */
  static resolveArray(root: unknown, paths: string[], locale: string): unknown[] {
    for (const path of Array.isArray(paths) ? paths : []) {
      const node = SsrShellPathResolver.resolveNode(root, path, locale);
      if (Array.isArray(node) && node.length) return node;
    }
    return [];
  }

  /** Reads a plain string/number, or a locale-keyed `{ [locale]: string }` map. */
  static readText(value: unknown, locale: string): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    const record = SsrShellPathResolver.asRecord(value);
    if (record) {
      const localized = locale ? record[locale] : undefined;
      if (typeof localized === 'string' && localized.trim()) return localized.trim();
      for (const entry of Object.values(record)) {
        if (typeof entry === 'string' && entry.trim()) return entry.trim();
      }
    }
    return '';
  }

  private static steps(path: string): string[] {
    return String(path || '')
      .split('.')
      .map((step) => step.trim())
      .filter((step) => step.length > 0);
  }

  private static walk(root: unknown, steps: string[], locale: string): unknown {
    let current: unknown = root;
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      current = SsrShellPathResolver.unwrapLocale(current, step, locale);
      if (current === null || current === undefined) return undefined;
      if (step === SsrShellPathResolver.WILDCARD) {
        return SsrShellPathResolver.firstResolving(current, steps.slice(index + 1), locale);
      }
      if (Array.isArray(current)) {
        const arrayIndex = Number.parseInt(step, 10);
        current = Number.isInteger(arrayIndex) && arrayIndex >= 0 ? current[arrayIndex] : undefined;
        continue;
      }
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[step];
    }
    return current;
  }

  private static firstResolving(value: unknown, rest: string[], locale: string): unknown {
    if (!Array.isArray(value)) return undefined;
    for (const entry of value) {
      const resolved = SsrShellPathResolver.walk(entry, rest, locale);
      if (SsrShellPathResolver.isNonEmpty(resolved, locale)) return resolved;
    }
    return undefined;
  }

  private static isNonEmpty(value: unknown, locale: string): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Boolean(SsrShellPathResolver.readText(value, locale));
    return String(value).trim().length > 0;
  }

  private static unwrapLocale(value: unknown, step: string, locale: string): unknown {
    const record = SsrShellPathResolver.asRecord(value);
    if (!record || Object.prototype.hasOwnProperty.call(record, step)) return value;
    const keys = Object.keys(record);
    if (!keys.length || !keys.every((key) => SsrShellPathResolver.LOCALE_KEY_RE.test(key))) return value;
    if (locale && record[locale] !== undefined) return record[locale];
    return record[keys[0]];
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
