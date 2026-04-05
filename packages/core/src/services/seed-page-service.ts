import { BaseService } from './base-service';

export class SeedPageService extends BaseService {
  get serviceName(): string {
    return 'SeedPageService';
  }

  buildPageLookupCandidates(baseCandidates: string[], page: { slug?: string; customPermalink?: string }): string[] {
    const values: string[] = [];

    const push = (value: unknown): void => {
      const raw = String(value || '').trim();
      if (!raw) return;
      if (!values.includes(raw)) values.push(raw);

      const withoutLeading = raw.replace(/^\/+/, '');
      if (withoutLeading && !values.includes(withoutLeading)) values.push(withoutLeading);

      const withLeading = `/${withoutLeading}`;
      if (withoutLeading && !values.includes(withLeading)) values.push(withLeading);
    };

    // Priority: custom permalink, then slug, then explicit candidates.
    push(page.customPermalink);
    push(page.slug);
    for (const candidate of baseCandidates || []) push(candidate);

    return values;
  }

  normalizeBlocks<T extends { data?: Record<string, unknown>; content?: Record<string, unknown> }>(blocks: T[]): T[] {
    const list = Array.isArray(blocks) ? blocks : [];

    return list.map((block) => {
      const normalizedPayload =
        block?.content && typeof block.content === 'object'
          ? block.content
          : block?.data && typeof block.data === 'object'
            ? block.data
            : {};

      return {
        ...block,
        data: normalizedPayload,
        content: normalizedPayload,
      };
    });
  }
}
