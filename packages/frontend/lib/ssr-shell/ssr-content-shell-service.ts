import type { ThemePrefetchApiEntry } from '../theme/theme-data-prefetcher.interfaces';
import type { SsrShellBuildOptions, SsrShellModel, SsrShellNavItem } from './ssr-content-shell.types';

/**
 * Pure builder for the server-rendered above-the-fold shell (`#fc-ssr-shell`).
 *
 * The client-only theme paints everything after the JS chain, so the SSR HTML is
 * visually empty (FCP/LCP = theme boot). This service turns data the server ALREADY
 * has — the resolved page document and the theme-declared nav prefetch payload — into
 * a tiny generic model (nav labels/hrefs + h1 + intro text) that a server component
 * renders as static HTML before the client tree. Domain-agnostic by construction:
 * it only reads generic document/menu shapes, never plugin- or theme-specific keys.
 */
export class SsrContentShellService {
  /** Opt-out env flag — `SSR_CONTENT_SHELL=false|0|off` disables the shell without a rebuild. */
  static isEnabled(): boolean {
    const flag = String(process.env.SSR_CONTENT_SHELL ?? '').trim().toLowerCase();
    return flag !== 'false' && flag !== '0' && flag !== 'off';
  }

  static build(doc: unknown, options: SsrShellBuildOptions = {}): SsrShellModel {
    const record = SsrContentShellService.asRecord(doc);
    const locale = String(options.locale || '').trim();
    const title = SsrContentShellService.readText(record?.title ?? record?.name, locale);
    const blocks = SsrContentShellService.resolveBlocks(record?.content, locale);
    const hero = SsrContentShellService.extractHero(blocks, locale);

    return {
      siteName: String(options.siteName || '').trim(),
      title,
      heading: hero.heading,
      text: hero.text,
      navItems: Array.isArray(options.navItems) ? options.navItems : [],
    };
  }

  static hasRenderableShell(model: SsrShellModel): boolean {
    return Boolean(model.title || model.heading || model.text || model.navItems.length);
  }

  /**
   * Picks the theme-flagged (`ssrShellNav: true`) prefetch payloads and normalizes their
   * top-level items to `{ label, href }`. Payload shape is the generic navigation
   * contract (`{ items: [...] }` or a bare array); anything else yields no items.
   */
  static extractNavItems(
    prefetchData: Record<string, unknown>,
    apis: ThemePrefetchApiEntry[],
  ): SsrShellNavItem[] {
    const items: SsrShellNavItem[] = [];
    for (const entry of Array.isArray(apis) ? apis : []) {
      if (!entry?.ssrShellNav) continue;
      const payload = prefetchData?.[String(entry.key || '').trim()];
      const rawItems = Array.isArray(payload)
        ? payload
        : (SsrContentShellService.asRecord(payload)?.items as unknown);
      if (!Array.isArray(rawItems)) continue;
      for (const raw of rawItems) {
        const item = SsrContentShellService.normalizeNavItem(raw);
        if (item) items.push(item);
      }
    }
    return items;
  }

  private static normalizeNavItem(raw: unknown): SsrShellNavItem | null {
    const record = SsrContentShellService.asRecord(raw);
    if (!record) return null;
    const label = String(record.label ?? record.title ?? '').trim();
    const href = String(record.url ?? record.href ?? '').trim();
    if (!label || !href) return null;
    // Only same-app paths and absolute http(s) links — never javascript:/data: schemes.
    if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) return null;
    return { label, href };
  }

  /** Content may be a block array, an HTML string, or a locale-keyed map of either. */
  private static resolveBlocks(content: unknown, locale: string): unknown[] {
    if (Array.isArray(content)) return content;
    const record = SsrContentShellService.asRecord(content);
    if (record) {
      if (locale && Array.isArray(record[locale])) return record[locale] as unknown[];
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) return value;
      }
    }
    return [];
  }

  /**
   * Extracts a heading + intro text from the first meaningful block. Reads only the
   * generic key candidates shared by the block system (`heading`/`title`,
   * `description`/`text`, top-level or under `data`, plus a slider's first slide).
   */
  private static extractHero(blocks: unknown[], locale: string): { heading: string; text: string } {
    for (const block of blocks.slice(0, SsrContentShellService.MAX_HERO_CANDIDATE_BLOCKS)) {
      const record = SsrContentShellService.asRecord(block);
      if (!record) continue;
      const data = SsrContentShellService.asRecord(record.data) || {};
      const slides = Array.isArray(record.slides) ? record.slides : (Array.isArray(data.slides) ? data.slides : []);
      const slide = SsrContentShellService.asRecord(slides[0]) || {};

      const heading = SsrContentShellService.firstText(
        [record.heading, data.heading, data.title, record.title, slide.heading],
        locale,
      );
      const text = SsrContentShellService.firstText(
        [record.description, data.description, data.text, record.text, slide.description],
        locale,
      );
      if (heading || text) return { heading, text };
    }
    return { heading: '', text: '' };
  }

  private static readonly MAX_HERO_CANDIDATE_BLOCKS = 3;

  private static firstText(candidates: unknown[], locale: string): string {
    for (const candidate of candidates) {
      const value = SsrContentShellService.readText(candidate, locale);
      if (value) return value;
    }
    return '';
  }

  /** Reads a plain string or a locale-keyed `{ [locale]: string }` map. */
  private static readText(value: unknown, locale: string): string {
    if (typeof value === 'string') return value.trim();
    const record = SsrContentShellService.asRecord(value);
    if (record) {
      const localized = locale ? record[locale] : undefined;
      if (typeof localized === 'string' && localized.trim()) return localized.trim();
      for (const entry of Object.values(record)) {
        if (typeof entry === 'string' && entry.trim()) return entry.trim();
      }
    }
    return '';
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
