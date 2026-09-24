import { Response } from 'express';
import { ICollection } from '@fromcode119/core';
import { RestControllerRuntime } from '@api/controllers/rest/rest-controller-runtime';
import { UserCollectionScopeGuard } from '@api/services/user-collection-scope-guard';

/** A record's version history: list, read one, restore. Each is held to the same account scope as the record. */
export class RestVersionController {
  constructor(private readonly runtime: RestControllerRuntime) {}

  async getVersions(collection: ICollection, req: any, res: Response) {
    try {
      const id = req.params.id;
      UserCollectionScopeGuard.ensureAllows(await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db), id);
      const limit = req.query.limit;
      const offset = req.query.offset;
      res.json(await this.runtime.versioningService.getVersions(collection.slug, id, {
        limit: limit ? parseInt(limit as string, 10) : 10,
        offset: offset ? parseInt(offset as string, 10) : 0,
      }));
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async getVersion(collection: ICollection, req: any, res: Response) {
    try {
      const id = req.params.id;
      UserCollectionScopeGuard.ensureAllows(await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db), id);
      const version = parseInt(req.params.version, 10);
      const result = await this.runtime.versioningService.getVersion(collection.slug, id, version);
      if (!result) {
        return res.status(404).json({ error: 'Version not found' });
      }
      res.json(result);
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async restoreVersion(collection: ICollection, req: any, res: Response) {
    try {
      UserCollectionScopeGuard.ensureAllows(await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db), req.params.id);
      const restoredData = await this.runtime.versioningService.restoreVersion(
        collection,
        req.params.id,
        parseInt(req.params.version, 10),
        req.user
      );
      res.json({
        message: `Successfully restored to version ${req.params.version}`,
        data: restoredData,
      });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }
}
