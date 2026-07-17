import type { SsrShellTemplateRule, SsrShellTemplateTarget } from './ssr-shell-theme-template.types';

/**
 * Selects the theme-owned SSR shell template for the resolved page.
 *
 * Generic by construction: rules are matched ONLY against the document's
 * generic identity — its `slug` and its layout name (`themeLayout` /
 * `pageTemplate`, both already resolved by `ResolvedContentShape`). The
 * framework never interprets what a slug or layout MEANS; the theme owns the
 * rule list (`theme.json` → `ui.ssrShell.templates`) and the template files.
 *
 * Semantics (documented in `ssr-shell-theme-template.types.ts`):
 *  - rules are evaluated in order; the FIRST match wins;
 *  - all keys present on a rule's `match` must match (AND);
 *  - a rule without `match` (or with an empty one) is a catch-all;
 *  - comparisons are case-insensitive and trimmed;
 *  - `slugIn: ['']` matches a document with no slug.
 */
export class SsrShellTemplateMatcher {
  static select(rules: SsrShellTemplateRule[], target: SsrShellTemplateTarget): string {
    const slug = SsrShellTemplateMatcher.normalize(target?.slug);
    const layout = SsrShellTemplateMatcher.normalize(target?.layout);
    for (const rule of Array.isArray(rules) ? rules : []) {
      if (!rule?.template) continue;
      if (SsrShellTemplateMatcher.matches(rule, slug, layout)) return rule.template;
    }
    return '';
  }

  private static matches(rule: SsrShellTemplateRule, slug: string, layout: string): boolean {
    const match = rule.match;
    if (!match || typeof match !== 'object') return true;

    if (Array.isArray(match.slugIn)) {
      const wanted = match.slugIn.map((value) => SsrShellTemplateMatcher.normalize(value));
      if (!wanted.includes(slug)) return false;
    }
    if (typeof match.slugPrefix === 'string' && match.slugPrefix.trim()) {
      if (!slug.startsWith(SsrShellTemplateMatcher.normalize(match.slugPrefix))) return false;
    }
    if (Array.isArray(match.layoutIn)) {
      const wanted = match.layoutIn.map((value) => SsrShellTemplateMatcher.normalize(value));
      if (!wanted.includes(layout)) return false;
    }
    if (typeof match.layoutPrefix === 'string' && match.layoutPrefix.trim()) {
      if (!layout.startsWith(SsrShellTemplateMatcher.normalize(match.layoutPrefix))) return false;
    }
    return true;
  }

  private static normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
