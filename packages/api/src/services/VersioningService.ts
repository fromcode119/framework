import { IDatabaseManager, eq, and, desc } from '@fromcode/database';
import { Collection, RecordVersions, Logger } from '@fromcode/core';

export class VersioningService {
  private logger = new Logger({ namespace: 'Versioning' });

  constructor(private db: IDatabaseManager) {}

  async createSnapshot(collection: Collection, refId: any, data: any, user: any, summary: string) {
    try {
      if (collection.slug === '_system_record_versions' || collection.slug === '_system_logs') return;
      
      // Get latest version number for this specific record
      const lastVersions = await this.db.find(RecordVersions.slug, {
        where: {
          ref_id: String(refId),
          ref_collection: collection.slug
        },
        orderBy: { version: 'desc' },
        limit: 1
      });
      
      const nextVersion = lastVersions.length > 0 ? (Number(lastVersions[0].version) || 0) + 1 : 1;
      
      await this.db.insert(RecordVersions.slug, {
        ref_id: String(refId),
        ref_collection: collection.slug,
        version: nextVersion,
        version_data: data,
        updated_by: user?.id || null,
        change_summary: summary
      });
    } catch (err: any) {
      this.logger.error(`Failed to create version snapshot for ${collection.slug}/${refId}: ${err.message}`);
    }
  }
}
