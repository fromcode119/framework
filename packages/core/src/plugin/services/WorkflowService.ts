import { Collection } from '../../types';
import { DatabaseManager, and, ne, lte, sql } from '@fromcode/database';
import { Logger } from '../../logging/logger';
import { HookManager } from '../../hooks/manager';

export class WorkflowService {
  private logger = new Logger({ namespace: 'WorkflowService' });

  constructor(
    private db: DatabaseManager,
    private hooks: HookManager
  ) {}

  /**
   * Scans all collections with workflow enabled and processes scheduled publishing.
   */
  async processScheduledContent(collections: Collection[]) {
    const now = new Date();
    const workflowCollections = collections.filter(c => c.workflow);

    if (workflowCollections.length === 0) return;

    for (const collection of workflowCollections) {
      try {
        // Find items that are draft/review and have a past scheduledPublishAt
        const pending = await this.db.find(collection.slug, {
          where: and(
            ne(sql.identifier('status'), 'published'),
            lte(sql.identifier('scheduledPublishAt'), now.toISOString())
          )
        });

        if (pending && pending.length > 0) {
          this.logger.info(`Publishing ${pending.length} scheduled items for collection "${collection.shortSlug}"`);
          
          for (const item of pending) {
            await this.db.update(collection.slug, { id: item.id }, {
              status: 'published',
              publishedAt: item.scheduledPublishAt || now.toISOString(),
              scheduledPublishAt: null,
              updatedAt: now.toISOString()
            });

            // Emit hook for other plugins to react (like clearing cache)
            this.hooks.emit(`collection:${collection.shortSlug}:published`, item);
            this.hooks.emit(`collection:published`, { 
               collection: collection.shortSlug, 
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
