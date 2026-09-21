import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';

/**
 * Who provides the `order`, the `product`, the `invoice` — so a plugin can point a relationship at one
 * without naming the collection, or the plugin, that happens to own it.
 *
 * A consumer writing `relationTo: 'ecommerce-orders'` is hardcoding another plugin's slug, which this
 * codebase does not allow. Writing `relationToEntity: 'order'` names shared vocabulary instead — the
 * same way `email` and `orderNumber` are shared — and the framework substitutes whichever collection
 * REGISTERED itself as that entity's provider.
 *
 * Substitution, not indirection: the field ends up holding an ordinary `relationTo`, so the searchable
 * relationship control, the list-column display and every server-side join behave exactly as before.
 * Replacing those relationships with opaque ids would have removed a working control to satisfy a
 * naming rule, which is a downgrade rather than a fix.
 *
 * Registration order is NOT guaranteed — lms may register before ecommerce — so a field that cannot be
 * resolved yet is parked and drained the moment its provider appears. Nothing reads a collection's
 * fields until every plugin has booted, so both paths settle before first use.
 */
export class PluginEntityProviderRegistry {
  private readonly providers = new Map<string, { slug: string; pluginSlug: string }>();
  private readonly pending: Array<{ field: IField; entity: string; consumerSlug: string }> = [];

  /** The provider a collection declares with `entity`. Last registration wins, as elsewhere. */
  registerProvider(collection: ICollection, pluginSlug: string): void {
    const entity = PluginEntityProviderRegistry.key(collection?.entity);
    const slug = String(collection?.slug || '').trim();
    if (!entity || !slug) return;
    this.providers.set(entity, { slug, pluginSlug: String(pluginSlug || '').trim() });
    this.drain(entity);
  }

  /**
   * Resolves every `relationToEntity` in this collection's fields, parking the ones whose provider has
   * not registered yet. Returns the entity keys left unresolved, for the caller to log.
   */
  resolveConsumer(collection: ICollection, pluginSlug: string): string[] {
    const unresolved: string[] = [];
    for (const field of PluginEntityProviderRegistry.walk(collection?.fields as IField[] | undefined)) {
      const entity = PluginEntityProviderRegistry.key((field as any).relationToEntity);
      if (!entity || field.relationTo) continue;
      const provider = this.providers.get(entity);
      if (provider) { field.relationTo = provider.slug; continue; }
      this.pending.push({ field, entity, consumerSlug: String(pluginSlug || '').trim() });
      unresolved.push(entity);
    }
    return unresolved;
  }

  /** Which collection provides an entity, or null. */
  providerSlug(entity: unknown): string | null {
    return this.providers.get(PluginEntityProviderRegistry.key(entity))?.slug ?? null;
  }

  clear(): void {
    this.providers.clear();
    this.pending.length = 0;
  }

  private drain(entity: string): void {
    const provider = this.providers.get(entity);
    if (!provider) return;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const waiting = this.pending[i]!;
      if (waiting.entity !== entity) continue;
      waiting.field.relationTo = provider.slug;
      this.pending.splice(i, 1);
    }
  }

  /** Entity keys are generic vocabulary, compared case-insensitively so `Order` and `order` are one. */
  private static key(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  /** Relationship fields also live inside `fields` of a group/array field, so the walk is recursive. */
  private static *walk(fields: IField[] | undefined): Generator<IField> {
    for (const field of fields || []) {
      yield field;
      yield* PluginEntityProviderRegistry.walk((field as any).fields as IField[] | undefined);
    }
  }
}
