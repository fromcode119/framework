import { IDatabaseManager, NamingStrategy, Schema } from '@fromcode119/database';
import { Logger, RecordVersions } from '@fromcode119/core';
import { type ICollection, FieldType, SystemConstants } from '@fromcode119/core';

export class VersioningService {
  private logger = new Logger({ namespace: 'versioning' });

  /** Resolves a snapshot's `ref_collection` to its definition; installed at boot by the api server. */
  private collectionLookup: (slug: string) => ICollection | undefined = () => undefined;

  constructor(private db: IDatabaseManager) {}

  useCollectionLookup(lookup: (slug: string) => ICollection | undefined): void {
    this.collectionLookup = lookup;
  }

  /** A stored version row as it may be served — see {@link withoutPasswordFields}. */
  redactStoredVersion<T>(row: T): T {
    const record = row as Record<string, unknown> | null;
    const slug = String(record?.ref_collection ?? '');
    return VersioningService.redactVersion(slug ? this.collectionLookup(slug) : undefined, row);
  }

  /**
   * A record's history without its `type: 'password'` fields.
   *
   * Snapshots were the raw stored row, so every saved account kept its bcrypt hash in the version
   * table and the versions API handed it back — the one door past the rule that a password field never
   * leaves the API (`DataProcessorService.filterHiddenFields`). A restore then wrote that old hash
   * back, quietly reinstating a password its owner had changed. A credential is not history: it is
   * never snapshotted, never served from a snapshot already holding one, and never restored.
   */
  static withoutPasswordFields<T>(collection: ICollection | undefined, data: T): T {
    if (!collection || !data || typeof data !== 'object' || Array.isArray(data)) return data;
    const secret = (collection.fields || [])
      .filter((field) => FieldType.resolve(field.type) === FieldType.PASSWORD)
      .map((field) => field.name);
    if (!secret.length) return data;
    const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    // A snapshot is the RAW stored row, whose columns are physical snake_case (`api_secret`), while the
    // schema names the field (`apiSecret`). Both spellings name the same stored value here.
    for (const name of secret) {
      delete copy[name];
      delete copy[NamingStrategy.toSnakeCase(name)];
    }
    return copy as T;
  }

  /** A version row as it may be served: its payload without password fields. */
  static redactVersion<T>(collection: ICollection | undefined, row: T): T {
    if (!row || typeof row !== 'object') return row;
    // Version rows come from the RAW manager, so the column is its physical snake_case name.
    const record = row as Record<string, unknown>;
    if (!('version_data' in record)) return row;
    let payload = record.version_data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return row; }
    }
    return { ...record, version_data: VersioningService.withoutPasswordFields(collection, payload) } as T;
  }

  async createSnapshot(collection: ICollection, refId: any, data: any, user: any, summary: string) {
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
        version_data: VersioningService.withoutPasswordFields(collection, data),
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

    let versions = (await this.db.find(RecordVersions.slug, {
      where,
      orderBy: { version: 'desc' },
      limit,
      offset
    })).map((row: any) => this.redactStoredVersion(row));

    if (versions.length > 0) {
      const userIds = [...new Set(versions.map(v => v.updated_by).filter(Boolean))];
      if (userIds.length > 0) {
        const userData = await this.db.find(Schema.users, { where: this.db.inArray(Schema.users.id, userIds) });
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
    return results?.[0] ? this.redactStoredVersion(results[0]) : null;
  }

  private resolveVersionData(versionData: unknown): Record<string, unknown> {
    if (versionData && typeof versionData === 'object' && !Array.isArray(versionData)) {
      return versionData as Record<string, unknown>;
    }

    if (typeof versionData === 'string' && versionData.trim()) {
      try {
        return this.resolveVersionData(JSON.parse(versionData));
      } catch (err: any) {
        this.logger.warn(`Failed to parse version payload: ${err.message}`);
      }
    }

    return {};
  }

  async restoreVersion(collection: ICollection, refId: any, version: number, user: any) {
    const targetVersion = await this.getVersion(collection.slug, refId, version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for ${collection.slug}/${refId}`);
    }

    const dataToRestore = VersioningService.withoutPasswordFields(collection, this.resolveVersionData(targetVersion.version_data));
    const primaryKey = collection.primaryKey || 'id';
    const where = { [primaryKey]: primaryKey === 'id' ? Number(refId) || refId : refId };
    
    // Perform the update on the target collection
    const restoredRecord = await this.db.update(collection.slug, where, dataToRestore);

    // Create a new snapshot for the restoration action itself
    await this.createSnapshot(
      collection, 
      refId, 
      restoredRecord || dataToRestore, 
      user, 
      `Restored to version ${version}`
    );

    return restoredRecord || dataToRestore;
  }
}