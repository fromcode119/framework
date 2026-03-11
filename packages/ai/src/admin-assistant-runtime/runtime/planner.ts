import type { AssistantCollectionContext } from '../types';

export class HomepagePlanner {
  static homepageCandidateCollections(collections: AssistantCollectionContext[]): AssistantCollectionContext[] {
    const scored = (Array.isArray(collections) ? collections : [])
      .map((collection) => {
        const scope = `${collection.slug} ${collection.shortSlug} ${collection.label}`.toLowerCase();
        let score = 0;
        if (/\bhome(page)?\b/.test(scope)) score += 5;
        if (/\b(page|pages|cms|landing|website|site)\b/.test(scope)) score += 3;
        if (/\bsettings|assistant|session\b/.test(scope)) score -= 4;
        return { collection, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return scored.map((entry) => entry.collection);
  }

  static resolveExplicitCollection(
    message: string,
    collections: AssistantCollectionContext[],
  ): AssistantCollectionContext[] {
    const normalizedMessage = String(message || '').toLowerCase();
    const deduped = new Map<string, AssistantCollectionContext>();
    for (const collection of Array.isArray(collections) ? collections : []) {
      const slug = String(collection.slug || '').toLowerCase();
      const shortSlug = String(collection.shortSlug || '').toLowerCase();
      if ((slug && normalizedMessage.includes(slug)) || (shortSlug && normalizedMessage.includes(shortSlug))) {
        deduped.set(collection.slug, collection);
      }
    }
    return Array.from(deduped.values());
  }

  static buildHomepageDraftScaffold(prompt: string): { markdown: string; payload: Record<string, any> } {
    const text = String(prompt || '').trim();
    const brandMatch = text.match(/\bfor\s+([a-z0-9][a-z0-9\s&-]{2,40})/i);
    const brand = String(brandMatch?.[1] || 'Your Brand').trim();
    const headline = 'Make your first impression impossible to ignore.';
    const subhead = `${brand} turns curious visitors into qualified leads with a homepage built for clarity and conversion.`;
    const primaryCta = 'Book a Free Strategy Call';
    const secondaryCta = 'See Client Results';
    const proof = [
      'Trusted by 120+ service businesses.',
      'Average homepage conversion lift: +34% after launch.',
      'Specialist support with real humans, not ticket limbo.',
    ];
    const ctaTitle = 'Ready to convert more of your existing traffic?';
    const ctaBody = 'Share your goals and constraints. We will map the fastest homepage path in 48 hours.';
    const faq = [
      { question: 'How long does a homepage refresh take?', answer: 'Most projects ship in 1-3 weeks depending on content and approvals.' },
      { question: 'Can you work with our current brand?', answer: 'Yes. We keep what is working and fix what hurts clarity and conversion.' },
      { question: 'Do you write copy too?', answer: 'Yes. We stage structure and copy together so each section supports the same goal.' },
      { question: 'Can we A/B test after launch?', answer: 'Yes. We can stage variants for hero and CTA blocks for controlled rollout.' },
    ];
    const markdown = [
      '## Hero',
      `**Headline:** ${headline}`,
      `**Subhead:** ${subhead}`,
      `**Primary CTA:** ${primaryCta}`,
      `**Secondary CTA:** ${secondaryCta}`,
      '',
      '## Proof',
      ...proof.map((item) => `- ${item}`),
      '',
      '## CTA Block',
      `**Title:** ${ctaTitle}`,
      `**Body:** ${ctaBody}`,
      `**Button:** ${primaryCta}`,
      '',
      '## FAQ',
      ...faq.map((entry, index) => `${index + 1}. **${entry.question}**\n   ${entry.answer}`),
    ].join('\n');
    return { markdown, payload: { title: 'Homepage Draft', content: markdown } };
  }

  static buildHomepagePayloadForCollection(
    collection: AssistantCollectionContext,
    scaffold: { markdown: string; payload: Record<string, any> },
  ): Record<string, any> {
    const fields = Array.isArray((collection as any)?.raw?.fields) ? (collection as any).raw.fields : [];
    if (!fields.length) return { ...scaffold.payload };

    const fieldMap = new Map<string, string>();
    for (const field of fields) {
      const name = String((field as any)?.name || '').trim();
      if (!name) continue;
      fieldMap.set(name.toLowerCase(), name);
    }

    const pick = (candidates: string[]): string | undefined => {
      for (const candidate of candidates) {
        const match = fieldMap.get(candidate.toLowerCase());
        if (match) return match;
      }
      return undefined;
    };

    const payload: Record<string, any> = {};
    const titleField = pick(['title', 'label', 'name', 'headline']);
    const contentField = pick(['content', 'body', 'description', 'copy', 'markdown']);
    const statusField = pick(['status', 'state']);
    const publishedField = pick(['published', 'isPublished', 'is_published', 'live']);
    if (titleField) payload[titleField] = 'Homepage Draft';
    if (contentField) payload[contentField] = scaffold.markdown;
    if (statusField) payload[statusField] = 'draft';
    if (publishedField) payload[publishedField] = false;
    return Object.keys(payload).length > 0 ? payload : { ...scaffold.payload };
  }
}