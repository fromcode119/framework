import type { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
import type { IEntityRecordGroup } from '@core/services/entity-records/interfaces/entity-record-group.interface';
import type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';
import type { IEntityRecordRef } from '@core/services/entity-records/interfaces/entity-record-ref.interface';
import type { IEntityRecordsResult } from '@core/services/entity-records/interfaces/entity-records-result.interface';

/**
 * Runs every registered entity-record provider for a person reference and
 * aggregates the results into one grouped, newest-first timeline.
 *
 * A provider that throws is isolated: its error is collected and the others still
 * return — one misbehaving plugin can never break a person's records view.
 */
export class EntityRecordsResolutionService {
  constructor(private readonly registry: PluginEntityRecordsRegistryService) {}

  async resolve(ref: IEntityRecordRef): Promise<IEntityRecordsResult> {
    const safeRef = this.normalizeRef(ref);
    const providers = this.registry.list();
    const items: IEntityRecordItem[] = [];
    const usedProviders: string[] = [];
    const errors: IEntityRecordsResult['errors'] = [];

    const settled = await Promise.all(
      providers.map(async (provider) => {
        try {
          const result = await provider.resolve(safeRef);
          return { provider, result: Array.isArray(result) ? result : [] };
        } catch (error: any) {
          errors.push({
            provider: provider.canonicalKey,
            message: String(error?.message || error || 'provider failed'),
          });
          return { provider, result: [] as IEntityRecordItem[] };
        }
      }),
    );

    for (const { provider, result } of settled) {
      if (!result.length) continue;
      usedProviders.push(provider.canonicalKey);
      for (const raw of result) {
        const item = this.normalizeItem(raw, provider.label);
        if (item) items.push(item);
      }
    }

    items.sort(this.byDateDesc);

    return {
      ref: safeRef,
      items,
      groups: this.groupItems(items),
      providers: usedProviders,
      errors,
    };
  }

  private normalizeRef(ref: IEntityRecordRef): IEntityRecordRef {
    return {
      personId: ref?.personId ?? null,
      userId: ref?.userId ?? null,
      email: ref?.email ? String(ref.email).trim().toLowerCase() : null,
    };
  }

  private normalizeItem(raw: IEntityRecordItem, fallbackGroup: string): IEntityRecordItem | null {
    const id = String(raw?.id ?? '').trim();
    const title = String(raw?.title ?? '').trim();
    if (!id || !title) return null;
    return {
      ...raw,
      id,
      title,
      group: String(raw?.group || fallbackGroup || 'Other').trim(),
      kind: String(raw?.kind || '').trim(),
    };
  }

  private groupItems(items: IEntityRecordItem[]): IEntityRecordGroup[] {
    const order: string[] = [];
    const buckets = new Map<string, IEntityRecordItem[]>();
    for (const item of items) {
      if (!buckets.has(item.group)) {
        buckets.set(item.group, []);
        order.push(item.group);
      }
      buckets.get(item.group)!.push(item);
    }
    return order.map((group) => ({ group, items: buckets.get(group)! }));
  }

  private byDateDesc(a: IEntityRecordItem, b: IEntityRecordItem): number {
    const da = a?.date ? Date.parse(a.date) : 0;
    const db = b?.date ? Date.parse(b.date) : 0;
    return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
  }
}
