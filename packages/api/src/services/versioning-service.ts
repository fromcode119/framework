import { IDatabaseManager, users } from '@fromcode119/database';
import { Logger, RecordVersions } from '@fromcode119/core';
import { type Collection, SystemConstants } from '@fromcode119/core';

export class VersioningService {
  private logger = new Logger({ namespace: 'versioning' });

  constructor(private db: IDatabaseManager) {}

  async createSnapshot(collection: Collection, refId: any, data: any, user: any, summary: string) {
    try {
      if (collection.slug === SystemConstants.TABLE.RECORD_VERSIONS || collection.slug === SystemConstants.TABLE.LOGS) return;
      
      // Get latest version number for this specific record
      const lastVersions = await this.db.find(RecordVersions.slug, {
        where: {
          ref_id: String(refId),
          ref_collection: collection.slug
        },
        orderBy: { version: 'desc' },
        limit: 1
      }) || [];
      
      const nextVersion = (lastVersions && lastVersions.length > 0) ? (Number(lastVersions[0].version) || 0) + 1 : 1;
      
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

  async getVersions(collectionSlug: string, refId: any, options: { limit?: number; offset?: number } = {}) {
    const { limit = 10, offset = 0 } = options;
    
    const where = {
      ref_id: String(refId),
      ref_collection: collectionSlug
    };

    let versions = await this.db.find(RecordVersions.slug, {
      where,
      orderBy: { version: 'desc' },
      limit,
      offset
    });

    if (versions.length > 0) {
      const userIds = [...new Set(versions.map(v => v.updated_by).filter(Boolean))];
      if (userIds.length > 0) {
        const userData = await this.db.find(users, { where: this.db.inArray(users.id, userIds) });
        const userMap = new Map(userData.map(u => [u.id, u.email || u.username]));
        versions = versions.map(v => ({ 
          ...v, 
          updated_by: userMap.get(v.updated_by) || v.updated_by 
        }));
      }
    }

    const total = await this.db.count(RecordVersions.slug, { where });

    return {
      docs: versions,
      totalDocs: total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      page: Math.floor(offset / limit) + 1
    };
  }

  async getVersion(collectionSlug: string, refId: any, version: number) {
    const results = await this.db.find(RecordVersions.slug, {
      where: {
        ref_id: String(refId),
        ref_collection: collectionSlug,
        version: version
      },
      limit: 1
    });
    return results?.[0] || null;
  }

  async restoreVersion(collection: Collection, refId: any, version: number, user: any) {
    const targetVersion = await this.getVersion(collection.slug, refId, version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for ${collection.slug}/${refId}`);
    }

    const dataToRestore = targetVersion.version_data;
    
    // Perform the update on the target collection
    await this.db.update(collection.slug, refId, dataToRestore);

    // Create a new snapshot for the restoration action itself
    await this.createSnapshot(
      collection, 
      refId, 
      dataToRestore, 
      user, 
      `Restored to version ${version}`
    );

    return dataToRestore;
  }
}