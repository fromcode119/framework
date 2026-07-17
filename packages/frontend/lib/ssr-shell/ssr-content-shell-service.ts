import { SsrShellPathResolver } from './ssr-shell-path-resolver';
import { SsrShellUrlSanitizer } from './ssr-shell-url-sanitizer';
import type { SsrShellBuildOptions, SsrShellModel, SsrShellSources } from './ssr-content-shell.types';
import type {
  SsrShellListConfig,
  SsrShellSourceKind,
  SsrShellThemeConfig,
  SsrShellTokenConfig,
  SsrShellValueSpec,
} from './ssr-shell-theme-template.types';

/**
 * Builds the server-rendered above-the-fold shell model.
 *
 * The client-only theme paints everything after the JS chain, so the SSR HTML is
 * visually empty (FCP/LCP = theme boot). This service turns data the server ALREADY
 * has into the model a server component renders as static HTML before the client tree.
 *
 * Domain-agnostic BY CONSTRUCTION: it contains no content-field names and no
 * "find the interesting block" heuristic. It only resolves the paths the THEME
 * declared (`theme.json` → `ui.ssrShell`) against framework-owned sources (the
 * resolved document, site settings, prefetch payloads). The only document keys it
 * reads itself are the document's generic identity — `title`/`name` and `slug` —
 * which the framework legitimately owns.
 */
export class SsrContentShellService {
  /** Opt-out env flag — `SSR_CONTENT_SHELL=false|0|off` disables the shell without a rebuild. */
  static isEnabled(): boolean {
    const flag = String(process.env.SSR_CONTENT_SHELL ?? '').trim().toLowerCase();
    return flag !== 'false' && flag !== '0' && flag !== 'off';
  }

  /**
   * Resolves every theme-declared token/list. A missing/unparseable config yields an
   * empty model — the caller then falls back to the framework's generic shell.
   */
  static build(
    sources: SsrShellSources,
    config: SsrShellThemeConfig | null,
    options: SsrShellBuildOptions = {},
  ): SsrShellModel {
    const locale = String(options.locale || '').trim();
    const tokens: Record<string, string> = {};
    let preloadImageUrl = '';

    for (const entry of config?.tokens || []) {
      const value = SsrContentShellService.resolveToken(entry, sources, locale, options);
      tokens[entry.name] = value;
      if (entry.preload && value && !preloadImageUrl) preloadImageUrl = value;
    }

    const lists: Record<string, Array<Record<string, string>>> = {};
    for (const entry of config?.lists || []) {
      lists[entry.name] = SsrContentShellService.resolveList(entry, sources, locale, options);
    }

    return { tokens, lists, preloadImageUrl };
  }

  static hasRenderableShell(model: SsrShellModel): boolean {
    return Boolean(
      model.preloadImageUrl
      || Object.values(model.tokens).some((value) => String(value || '').trim())
      || Object.values(model.lists).some((items) => items.length > 0),
    );
  }

  /** Generic document identity — the `<h1>` of the framework's fallback shell. */
  static readTitle(doc: unknown, locale = ''): string {
    const record = SsrContentShellService.asRecord(doc);
    return SsrShellPathResolver.readText(record?.title ?? record?.name, String(locale || '').trim());
  }

  /** Resolved page slug (generic doc key) — used by `pageMatchPath` guards + template matching. */
  static readSlug(doc: unknown): string {
    return String(SsrContentShellService.asRecord(doc)?.slug ?? '').trim();
  }

  private static resolveToken(
    entry: SsrShellTokenConfig,
    sources: SsrShellSources,
    locale: string,
    options: SsrShellBuildOptions,
  ): string {
    const source = SsrContentShellService.readSource(entry.from, entry.key, sources);
    if (!SsrContentShellService.matchesPage(entry, source, sources.doc, locale)) return '';
    return SsrContentShellService.resolveValue(source, entry, locale, options);
  }

  private static resolveList(
    entry: SsrShellListConfig,
    sources: SsrShellSources,
    locale: string,
    options: SsrShellBuildOptions,
  ): Array<Record<string, string>> {
    const source = SsrContentShellService.readSource(entry.from, entry.key, sources);
    const rows = SsrShellPathResolver.resolveArray(source, entry.paths, locale);
    const fieldNames = Object.keys(entry.fields || {});
    if (!fieldNames.length) return [];

    const items: Array<Record<string, string>> = [];
    for (const row of rows) {
      const item: Record<string, string> = {};
      let complete = true;
      for (const name of fieldNames) {
        const value = SsrContentShellService.resolveValue(row, entry.fields[name], locale, options);
        // A declared field that does not resolve (or a rejected URL) invalidates the whole
        // item — this is what drops nav entries without a label or with an unsafe href.
        if (!value) {
          complete = false;
          break;
        }
        item[name] = value;
      }
      if (complete) items.push(item);
    }
    return items;
  }

  private static resolveValue(
    source: unknown,
    spec: SsrShellValueSpec,
    locale: string,
    options: SsrShellBuildOptions,
  ): string {
    const raw = SsrShellPathResolver.resolveSpec(source, spec, locale);
    if (!raw) return '';
    const kind = SsrContentShellService.urlKind(spec);
    return kind ? SsrShellUrlSanitizer.sanitize(raw, kind, options) : raw;
  }

  /** `preload` implies asset semantics — the framework fetches that URL itself. */
  private static urlKind(spec: SsrShellValueSpec): SsrShellValueSpec['url'] {
    if (spec?.url) return spec.url;
    return (spec as SsrShellTokenConfig)?.preload ? 'asset' : undefined;
  }

  private static readSource(
    from: SsrShellSourceKind,
    key: string | undefined,
    sources: SsrShellSources,
  ): unknown {
    if (from === 'doc') return sources.doc;
    if (from === 'site') return sources.site;
    return sources.prefetch?.[String(key || '').trim()];
  }

  /**
   * `pageMatchPath` guard: resolve only when the payload's own slug equals the resolved
   * page slug or its last permalink segment (`numerology/consultation` matches a record
   * slug `consultation`). No guard configured → always resolve.
   */
  private static matchesPage(
    entry: SsrShellTokenConfig,
    source: unknown,
    doc: unknown,
    locale: string,
  ): boolean {
    if (!entry.pageMatchPath) return true;
    const matchValue = SsrShellPathResolver.resolveText(source, entry.pageMatchPath, locale);
    const slug = SsrContentShellService.readSlug(doc);
    if (!matchValue || !slug) return false;
    return matchValue === slug || matchValue === slug.split('/').pop();
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
