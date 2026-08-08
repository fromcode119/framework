import type { ICollection } from '@core/interfaces/collection.interface';
import { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { HookManager } from '@core/hooks/hook-manager';
import { HookEventUtils } from '@core/hook-events';

export class WorkflowService {
  private logger = new Logger({ namespace: 'workflow-service' });

  constructor(
    private db: IDatabaseManager,
    private hooks: HookManager
  ) {}

  /**
   * Scans all collections with workflow enabled and processes scheduled publishing.
   */
  async processScheduledContent(collections: ICollection[]) {
    const now = new Date();
    const workflowCollections = collections.filter(c => c.workflow);

    if (workflowCollections.length === 0) return;

    for (const collection of workflowCollections) {
      try {
        // Find items that are draft/review and have a past scheduledPublishAt.
        //
        // These filters MUST be a plain object. `collection.slug` is a STRING, so `find` takes the raw
        // SQL path, and `buildRawFilterSQL` only builds conditions when the where is a plain object
        // (`Object.getPrototypeOf(where) === Object.prototype`). A drizzle expression — `and(ne(...),
        // lte(...))` — is a class instance, so every condition was skipped, the WHERE clause came out
        // EMPTY, and this selected EVERY row of every workflow-enabled collection.
        //
        // That is not a cosmetic bug: each "pending" row is then written with status 'published' and
        // `published_at: now`, so on every scheduler tick it re-published all 32 CMS pages, overwrote
        // their real publication dates, would silently publish genuine DRAFTS, and emitted 32 spurious
        // `collection:published` hooks for subscribers to act on. Observed live on vselenskiportal88.
        //
        // A NULL `scheduledPublishAt` correctly matches nothing (`NULL <= now` is NULL), which is the
        // whole point: only rows with a real scheduled date are due.
        const pending = await this.db.find(collection.slug, {
          where: {
            status: { ne: 'published' },
            scheduledPublishAt: { lte: now.toISOString() },
          }
        });

        if (pending && pending.length > 0) {
          this.logger.info(`Publishing ${pending.length} scheduled items for collection "${collection.shortSlug}"`);
          
          for (const item of pending) {
            const scheduledPublishAt = item?.scheduled_publish_at || item?.scheduledPublishAt || null;
            await this.db.update(collection.slug, { id: item.id }, {
              status: 'published',
              published_at: scheduledPublishAt || now.toISOString(),
              scheduled_publish_at: null,
              updated_at: now.toISOString()
            });

            // Emit hook for other plugins to react (like clearing cache).
            // Identity comes from HookEventUtils like every other collection event. This used
            // `shortSlug` — a THIRD naming rule, and one that is neither unique across plugins nor
            // stable (ecommerce `products` registers as `catalog`), so a subscriber could not name this
            // event from its own schema.
            this.hooks.emit(HookEventUtils.collectionNotification(collection, 'published'), item);
            this.hooks.emit(`collection:published`, {
               collection: HookEventUtils.collectionIdentity(collection),
               fullSlug: collection.slug,
               item
            });
          }
        }
      } catch (err: any) {
        // Silently skip if table doesn't exist yet or columns are missing
        this.logger.debug(`Skipping workflow check for ${collection.slug}: ${err.message}`);
      }
    }
  }
}