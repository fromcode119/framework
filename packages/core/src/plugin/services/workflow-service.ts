import type { ICollection } from '@core/interfaces/collection.interface';
import { IDatabaseManager, and, ne, lte, sql } from '@fromcode119/database';
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
        // Find items that are draft/review and have a past scheduledPublishAt
        const pending = await this.db.find(collection.slug, {
          where: and(
            ne(sql.identifier('status'), 'published'),
            lte(sql.identifier('scheduled_publish_at'), now.toISOString())
          )
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