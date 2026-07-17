import type {
  SsrShellListConfig,
  SsrShellSourceKind,
  SsrShellTemplateRule,
  SsrShellThemeConfig,
  SsrShellTokenConfig,
  SsrShellUrlKind,
  SsrShellValueSpec,
} from './ssr-shell-theme-template.types';

/**
 * Parses + validates the raw `theme.json` → `ui.ssrShell` object into the normalized
 * config the rest of the shell consumes.
 *
 * Fail-safe by design: anything unrecognised is DROPPED rather than trusted, and a
 * config with no usable template rule returns null — the caller then renders the
 * framework's generic shell. There are no back-compat shims: the frontend image and
 * the theme deploy together, so a config this build cannot parse is simply a config
 * for a different build, and degrading to the generic shell is the correct outcome.
 */
export class SsrShellConfigNormalizer {
  /** Simple relative file path inside the theme ui dir — no traversal, no URLs. */
  private static readonly SAFE_ASSET_RE = /^[a-z0-9][a-z0-9._/-]*$/i;
  private static readonly NAME_RE = /^[a-zA-Z0-9_]+$/;
  private static readonly SOURCES: readonly SsrShellSourceKind[] = ['doc', 'site', 'prefetch'];
  private static readonly URL_KINDS: readonly SsrShellUrlKind[] = ['link', 'asset'];

  static normalize(raw: unknown): SsrShellThemeConfig | null {
    const record = SsrShellConfigNormalizer.asRecord(raw);
    if (!record) return null;
    const templates = SsrShellConfigNormalizer.normalizeTemplateRules(record);
    if (!templates.length) return null;
    const css = SsrShellConfigNormalizer.safeAssetPath(record.css);
    const fonts = SsrShellConfigNormalizer.normalizeFonts(record.fonts);
    return {
      templates,
      ...(css ? { css } : {}),
      tokens: SsrShellConfigNormalizer.normalizeTokens(record.tokens),
      lists: SsrShellConfigNormalizer.normalizeLists(record.lists),
      ...(fonts.length ? { fonts } : {}),
    };
  }

  private static normalizeTokens(raw: unknown): SsrShellTokenConfig[] {
    const tokens: SsrShellTokenConfig[] = [];
    let preloadTaken = false;
    for (const entry of Array.isArray(raw) ? (raw as unknown[]) : []) {
      const record = SsrShellConfigNormalizer.asRecord(entry);
      if (!record) continue;
      const name = SsrShellConfigNormalizer.safeName(record.name);
      const from = SsrShellConfigNormalizer.safeSource(record.from);
      const spec = SsrShellConfigNormalizer.valueSpec(record);
      if (!name || !from || !spec) continue;
      const key = String(record.key || '').trim();
      // A prefetch-sourced value without a payload key can never resolve.
      if (from === 'prefetch' && !key) continue;
      // Exactly one LCP image: a second `preload` flag is ignored, not obeyed.
      const preload = record.preload === true && !preloadTaken;
      if (preload) preloadTaken = true;
      const pageMatchPath = String(record.pageMatchPath || '').trim();
      tokens.push({
        name,
        from,
        ...spec,
        ...(key ? { key } : {}),
        ...(preload ? { preload } : {}),
        ...(pageMatchPath ? { pageMatchPath } : {}),
      });
    }
    return tokens;
  }

  private static normalizeLists(raw: unknown): SsrShellListConfig[] {
    const lists: SsrShellListConfig[] = [];
    for (const entry of Array.isArray(raw) ? (raw as unknown[]) : []) {
      const record = SsrShellConfigNormalizer.asRecord(entry);
      if (!record) continue;
      const name = SsrShellConfigNormalizer.safeName(record.name);
      const from = SsrShellConfigNormalizer.safeSource(record.from);
      const fields = SsrShellConfigNormalizer.normalizeFields(record.fields);
      if (!name || !from || !fields) continue;
      const key = String(record.key || '').trim();
      if (from === 'prefetch' && !key) continue;
      lists.push({
        name,
        from,
        paths: SsrShellConfigNormalizer.paths(record.path),
        fields,
        ...(key ? { key } : {}),
      });
    }
    return lists;
  }

  private static normalizeFields(raw: unknown): Record<string, SsrShellValueSpec> | null {
    const record = SsrShellConfigNormalizer.asRecord(raw);
    if (!record) return null;
    const fields: Record<string, SsrShellValueSpec> = {};
    for (const [name, value] of Object.entries(record)) {
      if (!SsrShellConfigNormalizer.safeName(name)) continue;
      // Shorthand: `"label": "label"` is the same as `{ "path": "label" }`.
      const spec = typeof value === 'string'
        ? SsrShellConfigNormalizer.valueSpec({ path: value })
        : SsrShellConfigNormalizer.valueSpec(SsrShellConfigNormalizer.asRecord(value) || {});
      if (spec) fields[name] = spec;
    }
    return Object.keys(fields).length ? fields : null;
  }

  private static valueSpec(record: Record<string, unknown>): SsrShellValueSpec | null {
    const paths = SsrShellConfigNormalizer.paths(record.path);
    if (!paths.length) return null;
    const pick = SsrShellConfigNormalizer.paths(record.pick);
    const url = SsrShellConfigNormalizer.URL_KINDS.includes(record.url as SsrShellUrlKind)
      ? (record.url as SsrShellUrlKind)
      : undefined;
    return { paths, ...(pick.length ? { pick } : {}), ...(url ? { url } : {}) };
  }

  /** `path` accepts one dot-path or an ordered candidate list (first non-empty wins). */
  private static paths(raw: unknown): string[] {
    const values = Array.isArray(raw) ? raw : [raw];
    return values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  }

  private static safeName(value: unknown): string {
    const name = String(value || '').trim();
    return SsrShellConfigNormalizer.NAME_RE.test(name) ? name : '';
  }

  private static safeSource(value: unknown): SsrShellSourceKind | '' {
    const from = String(value || '').trim() as SsrShellSourceKind;
    return SsrShellConfigNormalizer.SOURCES.includes(from) ? from : '';
  }

  private static normalizeTemplateRules(raw: Record<string, unknown>): SsrShellTemplateRule[] {
    const rules: SsrShellTemplateRule[] = [];
    for (const entry of Array.isArray(raw.templates) ? (raw.templates as unknown[]) : []) {
      const record = SsrShellConfigNormalizer.asRecord(entry);
      if (!record) continue;
      const template = SsrShellConfigNormalizer.safeAssetPath(record.template);
      if (!template) continue;
      const match = SsrShellConfigNormalizer.normalizeMatch(record.match);
      rules.push(match ? { match, template } : { template });
    }
    return rules;
  }

  private static normalizeMatch(raw: unknown): SsrShellTemplateRule['match'] | null {
    const record = SsrShellConfigNormalizer.asRecord(raw);
    if (!record) return null;
    const match: NonNullable<SsrShellTemplateRule['match']> = {};
    if (Array.isArray(record.slugIn)) match.slugIn = record.slugIn.map((value) => String(value ?? ''));
    if (typeof record.slugPrefix === 'string' && record.slugPrefix.trim()) match.slugPrefix = record.slugPrefix;
    if (Array.isArray(record.layoutIn)) match.layoutIn = record.layoutIn.map((value) => String(value ?? ''));
    if (typeof record.layoutPrefix === 'string' && record.layoutPrefix.trim()) {
      match.layoutPrefix = record.layoutPrefix;
    }
    return Object.keys(match).length ? match : null;
  }

  /**
   * Theme ui paths, ROOT-RELATIVE same-origin paths, or absolute http(s) URLs; anything
   * else is dropped.
   *
   * Root-relative is supported because a preload only pays off when its url is
   * byte-identical to the url the theme's `@font-face` later requests — otherwise it is
   * a pure duplicate download that also competes with the render-critical path. A theme
   * whose css uses root-relative font urls (resolving against the DOCUMENT origin once
   * the css is inlined into the head) can only be preloaded with that same spelling; the
   * versioned api-origin form a bare ui path expands to would never match.
   */
  private static normalizeFonts(raw: unknown): string[] {
    const fonts: string[] = [];
    for (const entry of Array.isArray(raw) ? (raw as unknown[]) : []) {
      if (typeof entry !== 'string') continue;
      const value = entry.trim();
      if (!value) continue;
      if (/^https?:\/\//i.test(value)) {
        fonts.push(value);
        continue;
      }
      const rooted = SsrShellConfigNormalizer.safeRootRelativePath(value);
      if (rooted) {
        fonts.push(rooted);
        continue;
      }
      const safe = SsrShellConfigNormalizer.safeAssetPath(value);
      if (safe) fonts.push(safe);
    }
    return fonts;
  }

  /**
   * A same-origin absolute path (`/api/v1/themes/<slug>/ui/fonts/x.woff2`).
   *
   * Only a SINGLE leading slash is same-origin: `//host/x.woff2` is protocol-relative and
   * resolves to a foreign origin, so it is rejected here rather than treated as a path.
   * The remainder is held to the same charset/`..` rules as any other asset path.
   */
  private static safeRootRelativePath(value: string): string {
    if (!value.startsWith('/') || value.startsWith('//')) return '';
    return SsrShellConfigNormalizer.safeAssetPath(value.slice(1)) ? value : '';
  }

  private static safeAssetPath(value: unknown): string {
    const path = String(value || '').trim();
    if (!path || path.includes('..') || !SsrShellConfigNormalizer.SAFE_ASSET_RE.test(path)) return '';
    return path;
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
