import { Request, Response } from 'express';
import { CoercionUtils, FieldType, ICollection } from '@fromcode119/core';
import { QueryHelper } from '@api/services/query-helper';
import { SystemMetaCollectionGuard } from '@api/services/system-meta-collection-guard';
import { UserCollectionScopeGuard } from '@api/services/user-collection-scope-guard';
import { CollectionArchiveReadClause } from '@api/services/collection-archive-read-clause';
import { RestControllerRuntime } from '@api/controllers/rest/rest-controller-runtime';

/**
 * The console's read tools — export and value suggestions. Both read raw columns across every record
 * of a collection, so both are for a reader who reads the whole collection. They used to admit anyone
 * the collection let browse: an anonymous `export` of a public collection returned up to 10,000 rows
 * with its drafts and stored access passwords, and `suggestions/<field>?q=` read any column back a
 * prefix at a time.
 */
export class RestConsoleReadController {
  constructor(private readonly runtime: RestControllerRuntime) {}

  async getSuggestions(collection: ICollection, req: Request, res: Response) {
    try {
      await this.runtime.accessPolicy.ensureReadsEverything(collection, req);
      // Suggestions return DISTINCT column values, which on the system meta table means the stored
      // token/secret values themselves. There is nothing to suggest there — fail closed.
      if (SystemMetaCollectionGuard.guards(collection)) {
        return res.json([]);
      }
      const field = CoercionUtils.toString(req.params.field);
      // A password column holds a credential hash; it is no value to suggest, to anyone.
      if (RestConsoleReadController.passwordFields(collection).includes(field)) {
        return res.json([]);
      }
      const query = (req.query as any).q;
      const userScope = await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db);
      // No accounts in scope means no suggestions — an empty `IN ()` must never reach the query.
      if (userScope?.ids?.length === 0) {
        return res.json([]);
      }
      res.json(await this.runtime.suggestionService.getSuggestions(
        collection, field, query, UserCollectionScopeGuard.buildWhere(userScope),
      ));
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async export(collection: ICollection, req: Request, res: Response) {
    try {
      await this.runtime.accessPolicy.ensureReadsEverything(collection, req);
      const format = req.query.format || 'json';
      const table = QueryHelper.getVirtualTable(collection);
      // The export path builds no WHERE of its own, so the system-meta restriction is applied here
      // too — a CSV export must never be the way around the redaction.
      const systemMetaClause = SystemMetaCollectionGuard.buildReadClause(collection);
      const userScopeClause = UserCollectionScopeGuard.buildReadClause(
        await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db),
      );
      const where = CollectionArchiveReadClause.combine(this.runtime.db, systemMetaClause || userScopeClause || undefined,
        CollectionArchiveReadClause.build(this.runtime.db, collection, table, false));
      const passwords = RestConsoleReadController.passwordFields(collection);
      let docs = (await this.runtime.db.find(table, { where, limit: 10000 }))
        .map((doc: any) => RestConsoleReadController.without(doc, passwords));
      // When the admin list passes `ids` (rows the user selected), export ONLY those records;
      // with no `ids`, export the whole collection.
      const idsParam = CoercionUtils.toString(req.query?.ids);
      if (idsParam) {
        const primaryKey = collection.primaryKey || 'id';
        const selected = new Set(idsParam.split(',').map((value) => value.trim()).filter(Boolean));
        docs = docs.filter((doc: any) => selected.has(String(doc[primaryKey])));
      }
      if (format === 'csv') {
        const fields = collection.fields.map((field) => field.name).filter((name) => !passwords.includes(name));
        const csvRows = [
          fields.join(','),
          ...docs.map((doc: any) => fields.map((field) => {
            const value = doc[field];
            const stringValue = value === null || value === undefined
              ? ''
              : (Object(value) === value ? JSON.stringify(value) : String(value));
            return `"${stringValue.replace(/"/g, '""')}"`;
          }).join(',')),
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.csv`);
        return res.send(csvRows.join('\n'));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.json`);
      res.json(docs);
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  /** `type: 'password'` columns, which never leave the API — the same rule every other read applies. */
  private static passwordFields(collection: ICollection): string[] {
    return collection.fields.filter((field) => FieldType.resolve(field.type) === FieldType.PASSWORD).map((field) => field.name);
  }

  private static without(doc: Record<string, unknown>, names: string[]): Record<string, unknown> {
    if (names.length === 0) return doc;
    const copy = { ...doc };
    for (const name of names) delete copy[name];
    return copy;
  }
}
