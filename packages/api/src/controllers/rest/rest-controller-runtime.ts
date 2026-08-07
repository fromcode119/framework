import { AuthManager } from '@fromcode119/auth';
import { HookManager, Logger } from '@fromcode119/core';
import { ICollection, HookEventUtils } from '@fromcode119/core';
import { CollectionHookPhase } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';
import { ActivityService } from '@api/services/activity-service';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';
import { DataProcessorService } from '@api/services/data-processor-service';
import { LocalizationService } from '@api/services/localization-service';
import { SuggestionService } from '@api/services/suggestion-service';
import { VersioningService } from '@api/services/versioning-service';
import { CollectionFieldGuard } from '@api/controllers/collection-field-guard';

export class RestControllerRuntime {
  readonly logger = new Logger({ namespace: 'REST' });
  readonly activityService: ActivityService;
  readonly versioningService: VersioningService;
  readonly suggestionService: SuggestionService;
  readonly localization: LocalizationService;
  readonly processor: DataProcessorService;
  readonly fieldGuard: CollectionFieldGuard;
  readonly accessPolicy: CollectionAccessPolicyService;

  constructor(
    readonly db: IDatabaseManager,
    auth?: AuthManager,
    private readonly onSettingsUpdate?: (key: string, value: any) => void | Promise<void>,
    private readonly hooks?: HookManager
  ) {
    this.activityService = new ActivityService(db);
    this.versioningService = new VersioningService(db);
    this.suggestionService = new SuggestionService(db);
    this.localization = new LocalizationService(db);
    this.processor = new DataProcessorService(auth, this.localization);
    this.fieldGuard = new CollectionFieldGuard(this.db, auth);
    this.accessPolicy = new CollectionAccessPolicyService();
  }

  async callCollectionHook<T>(collection: ICollection, phase: CollectionHookPhase, payload: T): Promise<T> {
    if (!this.hooks) {
      return payload;
    }
    // Identity comes from HookEventUtils, not from `collection.slug` — see collectionIdentity() for
    // why the declared slug is canonical and what silently broke while this used the physical one.
    return await this.hooks.call(HookEventUtils.collectionEvent(collection, phase), payload) as T;
  }

  resolveWriteTarget(collection: ICollection): string {
    return collection.tableName || collection.slug;
  }

  resolveRecordIdentifier(collection: ICollection, item: any): any {
    const primaryKey = collection.primaryKey || 'id';
    return item?.[primaryKey];
  }

  parseRecordIdentifier(collection: ICollection, id: string): any {
    const primaryKey = collection.primaryKey || 'id';
    return primaryKey === 'id' ? parseInt(id, 10) : id;
  }

  requireRecordIdentifier(collection: ICollection, id: string): any {
    const primaryKey = collection.primaryKey || 'id';
    const parsedId = this.parseRecordIdentifier(collection, id);
    if (primaryKey === 'id') {
      if (Number.isFinite(parsedId)) {
        return parsedId;
      }
    } else if (typeof parsedId === 'string' && parsedId.trim()) {
      return parsedId.trim();
    }

    const error = new Error(`Invalid ${primaryKey} identifier`);
    (error as any).statusCode = 400;
    throw error;
  }

  async insertCollectionRecord(collection: ICollection, table: any, data: any): Promise<any> {
    const primaryKey = collection.primaryKey;
    if (!primaryKey || primaryKey === 'id' || data[primaryKey] === undefined) {
      return this.db.insert(this.resolveWriteTarget(collection), data);
    }

    return this.db.upsert(table, data, {
      target: primaryKey,
      set: Object.fromEntries(Object.entries(data).filter(([key]) => key !== primaryKey)),
    });
  }

  emitCollectionEvent(collection: ICollection, action: string, payload: any): void {
    if (this.hooks) {
      // Hand-built from `collection.slug` this carried the same physical-vs-declared mismatch as
      // callCollectionHook. One identity rule, one place that knows the event format. `action` here is
      // a past-tense notification (`saved`, `deleted`), NOT a lifecycle phase — hence the separate
      // builder, which does not coerce it through CollectionHookPhase.
      this.hooks.emit(HookEventUtils.collectionNotification(collection, action), payload);
    }
    if (this.onSettingsUpdate && collection.slug === 'settings' && action === 'saved' && payload?.key) {
      // The callback was TYPED `=> void` while the function actually supplied is async and writes to
      // Redis — so the type checker could not see the floating promise, and a cache write failure on
      // any settings save became an unobserved rejection. emitCollectionEvent is synchronous by
      // contract, so the promise is observed here rather than awaited.
      Promise.resolve(this.onSettingsUpdate(String(payload.key), payload.value)).catch((error: unknown) =>
        console.error(`[RestControllerRuntime] Settings update side effect failed for "${String(payload.key)}":`, error)
      );
    }
  }
}
