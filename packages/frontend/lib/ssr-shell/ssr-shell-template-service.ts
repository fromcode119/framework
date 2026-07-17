import type { SsrShellModel } from './ssr-content-shell.types';
import type { LcpImagePreload } from '../theme/theme-data-prefetcher.interfaces';
import type { SsrShellThemeConfig } from './ssr-shell-theme-template.types';

/**
 * Minimal, safe renderer for theme-owned SSR shell templates.
 *
 * NOT a template engine — a fixed, documented contract (see
 * `ssr-shell-theme-template.types.ts`):
 *  - `{{#each list}}…{{/each}}` repeats the body per resolved list item, with the
 *    item's fields addressable as `{{field}}` inside it (outer tokens stay visible);
 *  - `{{#if name}}…{{/if}}` keeps the block only when the token has a non-empty
 *    value, or the LIST of that name has at least one item (nesting allowed, resolved
 *    innermost-first; no else, no expressions);
 *  - `{{token}}` substitutes the HTML-ESCAPED value; unknown tokens → ''.
 *
 * Every substituted value is escaped here, server-side — page/product data is
 * admin-authored but is escaped anyway (defense in depth). List items are escaped
 * exactly like scalar tokens, which is why the framework builds no markup of its own:
 * the theme's template owns every tag, including its nav `<li>`s.
 *
 * Handlebars is intentionally not used: it is an api-package dependency, not a
 * frontend one, and the shell needs no logic beyond presence-conditionals and one
 * repeat — a fixed token set over a few KB of markup.
 */
export class SsrShellTemplateService {
  /** Innermost-first: the body must not itself contain another `{{#each` opener. */
  private static readonly EACH_BLOCK_RE =
    /\{\{#each\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#each)[\s\S])*?)\{\{\/each\}\}/g;
  /** Innermost-first: the body must not itself contain another `{{#if` opener. */
  private static readonly IF_BLOCK_RE = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
  private static readonly TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  private static readonly LEFTOVER_RE = /\{\{[#/][^}]*\}\}/g;
  private static readonly MAX_PASSES = 8;

  static render(
    template: string,
    tokens: Record<string, string>,
    lists: Record<string, Array<Record<string, string>>> = {},
    rawTokens: Record<string, string> = {},
  ): string {
    // `#each` first: an expanded body may itself contain `#if`/tokens, which the
    // passes below then resolve against the merged (outer + item) token map.
    const expanded = SsrShellTemplateService.expandEach(template, tokens, lists, rawTokens);
    return SsrShellTemplateService.substitute(expanded, tokens, rawTokens, lists);
  }

  private static expandEach(
    template: string,
    tokens: Record<string, string>,
    lists: Record<string, Array<Record<string, string>>>,
    rawTokens: Record<string, string>,
  ): string {
    let out = String(template || '');
    for (let pass = 0; pass < SsrShellTemplateService.MAX_PASSES; pass += 1) {
      const next = out.replace(
        SsrShellTemplateService.EACH_BLOCK_RE,
        (_match, name: string, body: string) => {
          const items = Array.isArray(lists?.[name]) ? lists[name] : [];
          return items
            .map((item) => SsrShellTemplateService.substitute(body, { ...tokens, ...item }, rawTokens))
            .join('');
        },
      );
      if (next === out) break;
      out = next;
    }
    return out;
  }

  private static substitute(
    template: string,
    tokens: Record<string, string>,
    rawTokens: Record<string, string>,
    lists: Record<string, Array<Record<string, string>>> = {},
  ): string {
    const valueOf = (name: string): string => {
      if (Object.prototype.hasOwnProperty.call(rawTokens, name)) return String(rawTokens[name] ?? '');
      if (Object.prototype.hasOwnProperty.call(tokens, name)) return String(tokens[name] ?? '');
      return '';
    };
    // `#if` sees lists too, so a theme can wrap its `#each` in a presence guard. A list
    // name is never SUBSTITUTED (the framework renders no markup) — only tested here.
    const isPresent = (name: string): boolean =>
      Boolean(valueOf(name).trim()) || (Array.isArray(lists?.[name]) && lists[name].length > 0);

    // Resolve conditionals innermost-first, looping until stable so nested blocks
    // unwrap level by level.
    let out = String(template || '');
    for (let pass = 0; pass < SsrShellTemplateService.MAX_PASSES; pass += 1) {
      const next = out.replace(SsrShellTemplateService.IF_BLOCK_RE, (_match, name: string, body: string) =>
        isPresent(name) ? body : '');
      if (next === out) break;
      out = next;
    }
    return out
      .replace(SsrShellTemplateService.TOKEN_RE, (_match, name: string) =>
        Object.prototype.hasOwnProperty.call(rawTokens, name)
          ? valueOf(name)
          : SsrShellTemplateService.escapeHtml(valueOf(name)))
      // Malformed/orphan block markers — never ship template syntax to the browser.
      .replace(SsrShellTemplateService.LEFTOVER_RE, '');
  }

  /**
   * Template token map: the theme's resolved tokens plus the framework's MECHANISM
   * tokens. The preload-flagged token is re-pointed at the URL actually preloaded, so
   * the `<img>` the template renders and the `<link rel=preload>` can never disagree
   * (the srcset variant is resolved from the prefetch entry's own `lcp` config).
   */
  static buildTokens(
    model: SsrShellModel,
    config: SsrShellThemeConfig,
    preloadImage: LcpImagePreload | null,
    themeAssetBase: string,
  ): Record<string, string> {
    const tokens: Record<string, string> = {
      ...model.tokens,
      themeAssetBase,
      preloadSrcSet: preloadImage?.imageSrcSet || '',
      preloadSizes: preloadImage?.imageSizes || '',
    };
    const preloadToken = (config.tokens || []).find((entry) => entry.preload);
    if (preloadToken && preloadImage?.href) tokens[preloadToken.name] = preloadImage.href;
    return tokens;
  }

  static escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
