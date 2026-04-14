import { AuthManager } from '@fromcode119/auth';
import { HookManager, Logger } from '@fromcode119/core';
import { Collection, HookEventUtils } from '@fromcode119/core';
import { CollectionHookPhase } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';
import { ActivityService } from '../../services/activity-service';
import { CollectionAccessPolicyService } from '../../services/collection-access-policy-service';
import { DataProcessorService } from '../../services/data-processor-service';
import { LocalizationService } from '../../services/localization-service';
import { SuggestionService } from '../../services/suggestion-service';
import { VersioningService } from '../../services/versioning-service';
import { CollectionFieldGuard } from '../collection-field-guard';

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
    private readonly onSettingsUpdate?: (key: string, value: any) => void,
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

  async callCollectionHook<T>(collection: Collection, phase: CollectionHookPhase, payload: T): Promise<T> {
    if (!this.hooks) {
      return payload;
    }
    return await this.hooks.call(HookEventUtils.event(collection.slug, phase), payload) as T;
  }

  resolveWriteTarget(collection: Collection): string {
    return collection.tableName || collection.slug;
  }

  resolveRecordIdentifier(collection: Collection, item: any): any {
    const primaryKey = collection.primaryKey || 'id';
    return item?.[primaryKey];
  }

  parseRecordIdentifier(collection: Collection, id: string): any {
    const primaryKey = collection.primaryKey || 'id';
    return primaryKey === 'id' ? parseInt(id, 10) : id;
  }

  async insertCollectionRecord(collection: Collection, table: any, data: any): Promise<any> {
    const primaryKey = collection.primaryKey;
    if (!primaryKey || primaryKey === 'id' || data[primaryKey] === undefined) {
      return this.db.insert(this.resolveWriteTarget(collection), data);
    }

    return this.db.upsert(table, data, {
      target: primaryKey,
      set: Object.fromEntries(Object.entries(data).filter(([key]) => key !== primaryKey)),
    });
  }

  emitCollectionEvent(collection: Collection, action: string, payload: any): void {
    if (this.hooks) {
      this.hooks.emit(`collection:${collection.slug}:${action}`, payload);
    }
    if (this.onSettingsUpdate && collection.slug === 'settings' && action === 'saved' && payload?.key) {
      this.onSettingsUpdate(String(payload.key), payload.value);
    }
  }
}