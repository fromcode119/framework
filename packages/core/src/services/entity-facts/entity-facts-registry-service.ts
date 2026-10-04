import type { IEntityFactProviderRegistration } from '@core/services/entity-facts/interfaces/entity-fact-provider-registration.interface';

/**
 * Facts one plugin holds about another plugin's records — the average rating of a product, say — so the
 * owner can show them without naming, or querying, the plugin that holds them.
 *
 * Providers are keyed by plugin + entity + fact, so a re-init replaces rather than stacks. When several
 * plugins answer the same fact, the first one that knows an id answers for it. A provider that throws
 * answers nothing; the others still do. A provider whose plugin is disabled, or not enabled for the
 * site asking, is not asked and does not count for `has`.
 */
export class EntityFactsRegistryService {
  private readonly providers = new Map<string, IEntityFactProviderRegistration>();

  register(registration: Partial<IEntityFactProviderRegistration>): IEntityFactProviderRegistration | null {
    const namespace = String(registration?.namespace || '').trim();
    const pluginSlug = String(registration?.pluginSlug || '').trim();
    const entity = String(registration?.entity || '').trim();
    const fact = String(registration?.fact || '').trim();
    if (!pluginSlug || !entity || !fact || typeof registration?.resolve !== 'function') return null;
    const entry: IEntityFactProviderRegistration = { namespace, pluginSlug, entity, fact, resolve: registration.resolve, answers: registration.answers };
    this.providers.set(`${namespace}:${pluginSlug}:${entity}:${fact}`, entry);
    return entry;
  }

  /** Whether any plugin answers this fact — lets a caller say "no provider" instead of showing an empty value as if it were one. */
  has(entity: string, fact: string): boolean {
    return this.matching(entity, fact).length > 0;
  }

  async resolve(entity: string, fact: string, ids: Array<string | number>): Promise<Record<string, unknown>> {
    const wanted = Array.from(new Set((ids || []).map((id) => String(id ?? '').trim()).filter(Boolean)));
    const answers: Record<string, unknown> = {};
    if (!wanted.length) return answers;
    for (const provider of this.matching(entity, fact)) {
      const open = wanted.filter((id) => !(id in answers));
      if (!open.length) break;
      let values: Record<string, unknown> = {};
      try {
        values = (await provider.resolve(open)) || {};
      } catch {
        continue;
      }
      for (const id of open) {
        if (values[id] !== undefined) answers[id] = values[id];
      }
    }
    return answers;
  }

  clear(): void {
    this.providers.clear();
  }

  private matching(entity: string, fact: string): IEntityFactProviderRegistration[] {
    const e = String(entity || '').trim();
    const f = String(fact || '').trim();
    return Array.from(this.providers.values()).filter((entry) => entry.entity === e && entry.fact === f && entry.answers?.() !== false);
  }
}
