import type { AssistantCollectionContext } from '../types';
import { SearchTextHelpers } from './search-text-helpers';
import { PathObjectHelpers } from './path-object-helpers';

/** Homepage draft scaffold builders extracted from AdminAssistantRuntime. */
export class HomepageDraftHelpers {
  static buildHomepageDraftScaffold(prompt: string): { markdown: string; payload: Record<string, any> } {
    const text = String(prompt || '').trim();
    const brandMatch = text.match(/\bfor\s+([a-z0-9][a-z0-9\s&-]{2,40})/i);
    const brand = String(brandMatch?.[1] || 'Your Brand').trim();
    const headline = `Stop losing leads to a weak first impression.`;
    const subhead = `${brand} helps visitors understand your value in seconds and take action with confidence.`;
    const primaryCta = 'Book a Free Strategy Call';
    const secondaryCta = 'See Real Client Results';
    const proof = [
      'Trusted by 120+ businesses across high-competition niches.',
      'Average conversion uplift: +34% after homepage refresh.',
      'Live support from real specialists, not ticket black holes.',
    ];
    const ctaTitle = 'Ready to turn traffic into qualified leads?';
    const ctaBody = `Tell us your goals, timeline, and constraints. We'll return a sharp homepage plan in 48 hours.`;
    const faq = [
      { question: 'How long does a homepage refresh take?', answer: 'Most projects ship in 1-3 weeks depending on content readiness and integrations.' },
      { question: 'Can you keep our existing brand style?', answer: 'Yes. We keep what works, fix what hurts clarity, and align every section with your current identity.' },
      { question: 'Do you handle copy and structure?', answer: 'Yes. We provide the full page structure and conversion-focused copy, then refine with your team.' },
      { question: 'What if we need A/B testing after launch?', answer: 'We can stage follow-up variants for hero, CTA, and FAQ blocks and run iterative tests.' },
    ];
    const markdown = [
      '## Hero', `**Headline:** ${headline}`, `**Subhead:** ${subhead}`,
      `**Primary CTA:** ${primaryCta}`, `**Secondary CTA:** ${secondaryCta}`, '',
      '## Proof', ...proof.map((item) => `- ${item}`), '',
      '## CTA Block', `**Title:** ${ctaTitle}`, `**Body:** ${ctaBody}`, `**Button:** ${primaryCta}`, '',
      '## FAQ', ...faq.map((entry, index) => `${index + 1}. **${entry.question}**\n   ${entry.answer}`),
    ].join('\n');
    return { markdown, payload: { title: 'Homepage Draft', content: markdown } };
  }

  static resolveExplicitHomepageCollections(
    message: string, collections: AssistantCollectionContext[],
  ): AssistantCollectionContext[] {
    const normalizedMessage = SearchTextHelpers.normalizeSearchText(message);
    if (!normalizedMessage) return [];
    const deduped = new Map<string, AssistantCollectionContext>();
    for (const collection of Array.isArray(collections) ? collections : []) {
      const slug = SearchTextHelpers.normalizeSearchText(collection.slug);
      const shortSlug = SearchTextHelpers.normalizeSearchText(collection.shortSlug);
      if ((slug && normalizedMessage.includes(slug)) || (shortSlug && normalizedMessage.includes(shortSlug)))
        deduped.set(collection.slug, collection);
    }
    return Array.from(deduped.values());
  }

  static parseExplicitHomepageDraftTarget(
    message: string, collections: AssistantCollectionContext[],
  ): { collectionSlug: string; selector: { id?: string | number; entrySlug?: string; permalink?: string } } | null {
    const explicitCollections = HomepageDraftHelpers.resolveExplicitHomepageCollections(message, collections);
    if (explicitCollections.length !== 1) return null;
    const source = String(message || '').trim();
    const idMatch = source.match(/\b(?:record\s*)?id\s*(?:=|:|#)?\s*["']?([a-z0-9_-]+)["']?/i);
    const slugMatch = source.match(/\b(?:record\s*)?slug\s*(?:=|:)\s*["']?([a-z0-9][a-z0-9\-_\/]*)["']?/i);
    const permalinkMatch = source.match(/\b(?:permalink|path|url)\s*(?:=|:)\s*["']?([^"' \t\r\n]+)["']?/i);
    const selector: { id?: string | number; entrySlug?: string; permalink?: string } = {};
    const parsedId = String(idMatch?.[1] || '').trim();
    if (parsedId) selector.id = /^\d+$/.test(parsedId) ? Number(parsedId) : parsedId;
    const parsedSlug = String(slugMatch?.[1] || '').trim();
    if (parsedSlug) selector.entrySlug = parsedSlug;
    const parsedPermalink = String(permalinkMatch?.[1] || '').trim();
    if (parsedPermalink) selector.permalink = parsedPermalink;
    if (!selector.id && !selector.entrySlug && !selector.permalink) return null;
    return { collectionSlug: explicitCollections[0].slug, selector };
  }

  static homepageCandidateCollections(collections: AssistantCollectionContext[]): AssistantCollectionContext[] {
    return (Array.isArray(collections) ? collections : [])
      .map((collection) => {
        const scope = `${collection.slug} ${collection.shortSlug} ${collection.label}`.toLowerCase();
        let score = 0;
        if (/\bhome(page)?\b/.test(scope)) score += 5;
        if (/\b(page|pages|cms|landing|website|site)\b/.test(scope)) score += 3;
        if (/\bsettings|assistant|session\b/.test(scope)) score -= 4;
        return { collection, score };
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((e) => e.collection);
  }

  static resolveHomepageDraftCollection(
    message: string, collections: AssistantCollectionContext[],
  ): { status: 'resolved' | 'missing' | 'ambiguous'; collectionSlug?: string; candidateCollections: string[] } {
    const explicitCollections = HomepageDraftHelpers.resolveExplicitHomepageCollections(message, collections);
    const candidates = (
      explicitCollections.length ? explicitCollections : HomepageDraftHelpers.homepageCandidateCollections(collections)
    ).slice(0, 6);
    const deduped = Array.from(new Map(candidates.map((e) => [e.slug, e])).values());
    const candidateCollections = deduped.map((e) => e.slug);
    if (!deduped.length) return { status: 'missing', candidateCollections: [] };
    if (deduped.length === 1) return { status: 'resolved', collectionSlug: deduped[0].slug, candidateCollections };
    return { status: 'ambiguous', candidateCollections };
  }

  static buildHomepageDraftHandle(now?: () => string): string {
    const nowValue = typeof now === 'function' ? now() : new Date().toISOString();
    const suffix = String(nowValue || '').replace(/[^0-9]/g, '').slice(0, 12);
    return `homepage-draft-${suffix || String(Date.now()).slice(-8)}`;
  }

  static buildHomepageDraftPayloadForCollection(
    collection: AssistantCollectionContext,
    scaffold: { markdown: string; payload: Record<string, any> },
    now?: () => string,
  ): Record<string, any> {
    const fields = Array.isArray((collection as any)?.raw?.fields) ? (collection as any).raw.fields : [];
    if (!fields.length) return PathObjectHelpers.deepClone(scaffold.payload);
    const fieldMap = new Map<string, string>();
    for (const field of fields) {
      const name = String((field as any)?.name || '').trim();
      if (name) fieldMap.set(name.toLowerCase(), name);
    }
    const resolveField = (opts: string[]): string | null => {
      for (const o of opts) { const m = fieldMap.get(String(o || '').toLowerCase()); if (m) return m; }
      return null;
    };
    const payload: Record<string, any> = {};
    const draftHandle = HomepageDraftHelpers.buildHomepageDraftHandle(now);
    const titleField = resolveField(['title', 'label', 'name', 'headline']);
    const contentField = resolveField(['content', 'body', 'description', 'copy', 'markdown']);
    const slugField = resolveField(['slug', 'entrySlug', 'lookupSlug']);
    const permalinkField = resolveField(['permalink', 'path', 'url', 'customPermalink']);
    const statusField = resolveField(['status', 'state']);
    const publishedField = resolveField(['published', 'isPublished', 'is_published', 'live']);
    const draftFlagField = resolveField(['isDraft', 'is_draft', 'draft']);
    if (titleField) payload[titleField] = 'Homepage Draft';
    if (contentField) payload[contentField] = scaffold.markdown;
    if (slugField) payload[slugField] = draftHandle;
    if (permalinkField) payload[permalinkField] = `/${draftHandle}`;
    if (statusField) payload[statusField] = 'draft';
    if (publishedField) payload[publishedField] = false;
    if (draftFlagField) payload[draftFlagField] = true;
    const merged = { ...PathObjectHelpers.deepClone(scaffold.payload), ...payload };
    const filtered = PathObjectHelpers.filterContentPayloadByCollectionFields(collection, merged);
    if (Object.keys(filtered).length > 0) return filtered;
    const primaryKey = String((collection as any)?.raw?.primaryKey || 'id').trim().toLowerCase();
    const writableFallback = Array.from(fieldMap.entries()).map((e) => e[1]).find((name) => {
      const n = String(name || '').trim().toLowerCase();
      return n && n !== primaryKey && !['id', 'createdat', 'updatedat', 'deletedat'].includes(n);
    });
    if (!writableFallback) return {};
    return { [writableFallback]: scaffold.markdown };
  }
}
