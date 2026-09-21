import type { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
import type { IEntityRecordGroup } from '@core/services/entity-records/interfaces/entity-record-group.interface';
import type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';
import type { IEntityRecordRef } from '@core/services/entity-records/interfaces/entity-record-ref.interface';
import type { IEntityRecordsResult } from '@core/services/entity-records/interfaces/entity-records-result.interface';
import type { IEntityRecordSubject } from '@core/services/entity-records/interfaces/entity-record-subject.interface';

/**
 * Runs the registered entity-record providers a reference is ALLOWED to reach, and aggregates their
 * results into one grouped, newest-first timeline.
 *
 * Two kinds of question, and they are kept strictly apart:
 *
 * - a PERSON ref reaches providers that declared no `matchKeys` ("what does this person have?");
 * - a SUBJECT ref reaches providers that declared a `matchKey` the subject actually offers ("what
 *   relates to THIS record?").
 *
 * Never both. An order subject carries the customer's email, so letting person providers see it would
 * put that customer's entire invoice history on one order — right-looking, completely wrong.
 *
 * A provider that throws is isolated: its error is collected and the others still return — one
 * misbehaving plugin can never break the view.
 */
export class EntityRecordsResolutionService {
  constructor(private readonly registry: PluginEntityRecordsRegistryService) {}

  async resolve(ref: IEntityRecordRef): Promise<IEntityRecordsResult> {
    const safeRef = this.normalizeRef(ref);
    const providers = this.selectProviders(safeRef);
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
    const subject = this.normalizeSubject(ref?.subject);
    // A subject ref carries NO person fields. They would only be there to be matched on, and matching
    // them is exactly the leak this split exists to prevent.
    if (subject) return { personId: null, userId: null, email: null, subject };
    return {
      personId: ref?.personId ?? null,
      userId: ref?.userId ?? null,
      email: ref?.email ? String(ref.email).trim().toLowerCase() : null,
      subject: null,
    };
  }

  /** Keys with an empty value are dropped: a provider matching on one would answer for everything. */
  private normalizeSubject(value: unknown): IEntityRecordSubject | null {
    const raw = value as IEntityRecordSubject | null | undefined;
    const kind = String(raw?.kind ?? '').trim();
    const id = String(raw?.id ?? '').trim();
    if (!kind || !id) return null;
    const keys: Record<string, string> = {};
    for (const [name, keyValue] of Object.entries(raw?.keys ?? {})) {
      const cleanName = String(name ?? '').trim();
      const cleanValue = String(keyValue ?? '').trim();
      if (cleanName && cleanValue) keys[cleanName] = cleanValue;
    }
    return { kind, id, keys };
  }

  /**
   * Which providers this ref may reach. Key NAMES are compared; the framework never reads a value and
   * never interprets what a key or a subject kind means.
   */
  private selectProviders(ref: IEntityRecordRef) {
    const subject = ref.subject;
    if (!subject) return this.registry.list().filter((provider) => !provider.matchKeys?.length);
    const offered = Object.keys(subject.keys);
    if (!offered.length) return [];
    return this.registry
      .list()
      .filter((provider) => (provider.matchKeys ?? []).some((key) => offered.includes(key)));
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
