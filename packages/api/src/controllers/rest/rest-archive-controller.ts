import { Response } from 'express';
import { CollectionArchive, CollectionLabelUtils, ICollection } from '@fromcode119/core';
import { NamingStrategy } from '@fromcode119/database';
import { UserCollectionScopeGuard } from '@api/services/user-collection-scope-guard';
import { RestControllerRuntime } from '@api/controllers/rest/rest-controller-runtime';
import { ArchiveCascadeSkip } from '@api/controllers/rest/enums/archive-cascade-skip.enum';
import type { IArchiveCascadeOutcome } from '@api/controllers/rest/interfaces/archive-cascade-outcome.interface';

/**
 * Archive and Restore for a collection declaring `archive` (see `ICollectionArchive`).
 *
 * Archiving stamps `archivedAt`; every list and count then leaves the record out. When the collection
 * LEADS a correlation key, every archivable collection that FOLLOWS that key has its matching records
 * archived too, stamped with the same moment and with `archivedWith` naming the leader. Restoring the
 * leader restores exactly those records — the ones it took along, never one that was archived on its
 * own — so an archive is always undone by the control that did it.
 *
 * Neither side names the other: a follower is found by the key NAME it declares, the same shared
 * vocabulary record links use. A follower the operator may not update is left alone and reported,
 * never written through the leader's permission.
 */
export class RestArchiveController {
  private collections: () => ICollection[] = () => [];

  constructor(private readonly runtime: RestControllerRuntime) {}

  /** Every registered collection, so a leader can find its followers. Wired once at boot. */
  useCollections(provider: () => ICollection[]): void {
    this.collections = provider;
  }

  async archive(collection: ICollection, req: any, res: Response) {
    return this.run(collection, req, res, true);
  }

  async restore(collection: ICollection, req: any, res: Response) {
    return this.run(collection, req, res, false);
  }

  private async run(collection: ICollection, req: any, res: Response, archiving: boolean) {
    try {
      if (!CollectionArchive.isArchivable(collection)) {
        return res.status(400).json({ error: `Records of "${collection.slug}" cannot be archived.` });
      }
      await this.runtime.accessPolicy.ensureUpdateAllowed(collection, req);
      const ids = await this.requestedIds(collection, req);
      if (ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }

      const rows = await this.rowsIn(collection, ids, archiving);
      const at = new Date();
      const changedIds: unknown[] = [];
      const cascaded: IArchiveCascadeOutcome[] = [];
      for (const row of rows) {
        const id = this.runtime.resolveRecordIdentifier(collection, row);
        await this.stamp(collection, id, archiving ? at : null, null);
        changedIds.push(id);
        const outcomes = archiving
          ? await this.archiveFollowers(collection, row, at, req)
          : await this.restoreFollowers(collection, id, req);
        cascaded.push(...outcomes);
      }

      if (changedIds.length > 0) {
        this.runtime.emitCollectionEvent(collection, archiving ? 'archived' : 'restored', { ids: changedIds, count: changedIds.length });
      }
      res.json({ success: true, count: changedIds.length, cascaded: this.merge(cascaded) });
    } catch (err: any) {
      this.runtime.logger.error(`Failed to ${archiving ? 'archive' : 'restore'} ${collection.slug} records: ${err.message}`);
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  /** The ids in the body the caller may touch at all. */
  private async requestedIds(collection: ICollection, req: any): Promise<unknown[]> {
    const raw = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const scope = await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db);
    return raw
      .map((id: unknown) => this.runtime.requireRecordIdentifier(collection, String(id)))
      .filter((id: unknown) => UserCollectionScopeGuard.allows(scope, id));
  }

  /** The requested rows still in the other state — archiving an archived record changes nothing. */
  private async rowsIn(collection: ICollection, ids: unknown[], live: boolean): Promise<Record<string, unknown>[]> {
    const primaryKey = collection.primaryKey || 'id';
    const rows = await this.runtime.db.find(this.runtime.resolveWriteTarget(collection), {
      where: { [primaryKey]: { in: ids } },
    }) as Record<string, unknown>[];
    return rows
      .map((row) => NamingStrategy.denormalizeRecord(row) as Record<string, unknown>)
      .filter((row) => CollectionArchive.isArchived(row) !== live);
  }

  private async stamp(collection: ICollection, id: unknown, at: Date | null, withReference: string | null): Promise<void> {
    const primaryKey = collection.primaryKey || 'id';
    await this.runtime.db.update(this.runtime.resolveWriteTarget(collection), { [primaryKey]: id }, {
      [CollectionArchive.ARCHIVED_AT]: at,
      [CollectionArchive.ARCHIVED_WITH]: withReference,
    });
  }

  private async archiveFollowers(leader: ICollection, row: Record<string, unknown>, at: Date, req: any): Promise<IArchiveCascadeOutcome[]> {
    const reference = CollectionArchive.reference(leader, this.runtime.resolveRecordIdentifier(leader, row));
    const outcomes: IArchiveCascadeOutcome[] = [];
    for (const [key, leaderField] of CollectionArchive.leads(leader)) {
      const value = row[leaderField];
      if (value === null || value === undefined || value === '') continue;
      for (const follower of this.followersOf(leader, key)) {
        const field = CollectionArchive.followField(follower, key) as string;
        outcomes.push(await this.cascade(follower, req, { [field]: value, [CollectionArchive.ARCHIVED_AT]: null }, at, reference));
      }
    }
    return outcomes;
  }

  private async restoreFollowers(leader: ICollection, id: unknown, req: any): Promise<IArchiveCascadeOutcome[]> {
    const reference = CollectionArchive.reference(leader, id);
    const keys = new Set(CollectionArchive.leads(leader).map(([key]) => key));
    const followers = this.collections().filter((candidate) => candidate.slug !== leader.slug
      && [...keys].some((key) => CollectionArchive.followField(candidate, key)));
    const outcomes: IArchiveCascadeOutcome[] = [];
    for (const follower of followers) {
      outcomes.push(await this.cascade(follower, req, { [CollectionArchive.ARCHIVED_WITH]: reference }, null, null));
    }
    return outcomes;
  }

  private followersOf(leader: ICollection, key: string): ICollection[] {
    return this.collections().filter((candidate) => candidate.slug !== leader.slug
      && CollectionArchive.isArchivable(candidate)
      && CollectionArchive.followField(candidate, key));
  }

  /**
   * Moves one follower collection's matching rows into the new state. A follower the operator may not
   * update, or whose table this site does not have, is reported rather than failing the leader: the
   * leader's own archive has already happened and is what the operator asked for.
   */
  private async cascade(
    follower: ICollection,
    req: any,
    where: Record<string, unknown>,
    at: Date | null,
    reference: string | null,
  ): Promise<IArchiveCascadeOutcome> {
    const label = CollectionLabelUtils.labelFor(follower, follower.shortSlug || follower.slug);
    try {
      await this.runtime.accessPolicy.ensureUpdateAllowed(follower, req);
    } catch {
      return { collection: follower.slug, label, count: 0, skipped: ArchiveCascadeSkip.PERMISSION.value };
    }
    try {
      const rows = await this.runtime.db.find(this.runtime.resolveWriteTarget(follower), { where }) as Record<string, unknown>[];
      const ids = rows.map((row) => this.runtime.resolveRecordIdentifier(follower, row));
      for (const id of ids) await this.stamp(follower, id, at, reference);
      if (ids.length > 0) {
        this.runtime.emitCollectionEvent(follower, at ? 'archived' : 'restored', { ids, count: ids.length, with: reference });
      }
      return { collection: follower.slug, label, count: ids.length };
    } catch (err: any) {
      this.runtime.logger.warn(`Archive cascade into ${follower.slug} failed: ${err?.message}`);
      return { collection: follower.slug, label, count: 0, skipped: ArchiveCascadeSkip.ERROR.value };
    }
  }

  /** One line per follower collection, however many leaders the request carried. */
  private merge(outcomes: IArchiveCascadeOutcome[]): IArchiveCascadeOutcome[] {
    const byCollection = new Map<string, IArchiveCascadeOutcome>();
    for (const outcome of outcomes) {
      const existing = byCollection.get(outcome.collection);
      if (!existing) {
        byCollection.set(outcome.collection, { ...outcome });
        continue;
      }
      existing.count += outcome.count;
      existing.skipped = existing.skipped ?? outcome.skipped;
    }
    return [...byCollection.values()];
  }
}
