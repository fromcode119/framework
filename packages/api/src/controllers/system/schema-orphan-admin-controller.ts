import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger } from '@fromcode119/core';

/**
 * HTTP for the database-schema review: the columns nothing declares, and the decision to drop one.
 * Platform admins only (the router) — the schema is shared by every site on the server.
 *
 * `list` COUNTS at the moment it is asked, across every site, because an operator reading "0 rows" must
 * be able to trust it; where the count could not be taken it says so rather than printing a zero.
 * `drop` removes one column the service itself proposed and refuses any other name.
 */
export class SchemaOrphanAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'schema-orphan-admin' });

  constructor(private readonly manager: any) {
    super();
  }

  async list(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ columns: await this.manager.schemaManager.pendingDrops() });
    } catch (error) {
      this.logger.error('Reading the undeclared columns failed', error);
      res.status(500).json({ error: 'schema_orphans_unavailable' });
    }
  }

  async drop(req: Request, res: Response): Promise<void> {
    const table = CoercionUtils.toString(req.body?.table).trim();
    const column = CoercionUtils.toString(req.body?.column).trim();
    if (!table || !column) {
      res.status(400).json({ error: 'table_and_column_required' });
      return;
    }
    try {
      res.json({ dropped: await this.manager.schemaManager.approveDrop(table, column) });
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      if (String(error?.message || '').includes('is not awaiting approval')) {
        res.status(404).json({ error: 'not_awaiting_approval', message: error.message });
        return;
      }
      this.logger.error(`Dropping ${table}.${column} failed`, error);
      res.status(500).json({ error: 'schema_drop_failed' });
    }
  }
}
