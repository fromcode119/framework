import type { IRestAuditSink } from '@api/controllers/rest/interfaces/rest-audit-sink.interface';
import { AuditOutcome } from '@fromcode119/core';
import { Request, Response } from 'express';
import { AuthManager } from '@fromcode119/auth';
import { ICollection, HookManager } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';
import { RestBulkController } from '@api/controllers/rest/rest-bulk-controller';
import { RestControllerRuntime } from '@api/controllers/rest/rest-controller-runtime';
import { RestReadController } from '@api/controllers/rest/rest-read-controller';
import { RestWriteController } from '@api/controllers/rest/rest-write-controller';

export class RESTController {
  private readonly runtime: RestControllerRuntime;
  private readonly readController: RestReadController;
  private readonly writeController: RestWriteController;
  private readonly bulkController: RestBulkController;
  private readonly audit?: IRestAuditSink;

  constructor(
    db: IDatabaseManager,
    auth?: AuthManager,
    onSettingsUpdate?: (key: string, value: any) => void | Promise<void>,
    hooks?: HookManager,
    audit?: IRestAuditSink
  ) {
    this.runtime = new RestControllerRuntime(db, auth, onSettingsUpdate, hooks);
    this.readController = new RestReadController(this.runtime);
    this.writeController = new RestWriteController(this.runtime);
    this.bulkController = new RestBulkController(this.runtime);
    this.audit = audit;
  }

  /**
   * Request-level audit of every collection MUTATION with the acting user — reads are never audited.
   * Fire-and-forget and best-effort: auditing must never slow or break the write path.
   */
  private recordMutation(action: string, collection: ICollection, req: any): void {
    if (!this.audit) return;
    const user = req?.user || {};
    const id = req?.params?.id;
    // pluginSlug must be 'system' — the audit READ endpoint filters rows to system/active-plugin slugs.
    void this.audit
      .logAction('system', `collection.${action}`, `${collection.slug}${id ? `/${id}` : ''}`, AuditOutcome.ALLOWED, {
        userId: user.id, email: user.email,
      })
      .catch(() => undefined);
  }

  async find(collection: ICollection, req: any, res?: Response) {
    return this.readController.find(collection, req, res);
  }

  async findOne(collection: ICollection, req: any, res?: Response) {
    return this.readController.findOne(collection, req, res);
  }

  async create(collection: ICollection, req: any, res?: Response) {
    this.recordMutation('create', collection, req);
    return this.writeController.create(collection, req, res);
  }

  async update(collection: ICollection, req: any, res?: Response) {
    this.recordMutation('update', collection, req);
    return this.writeController.update(collection, req, res);
  }

  async delete(collection: ICollection, req: any, res?: Response) {
    this.recordMutation('delete', collection, req);
    return this.writeController.delete(collection, req, res);
  }

  async bulkCreate(collection: ICollection, req: any, res?: Response) {
    this.recordMutation('bulk-create', collection, req);
    return this.bulkController.bulkCreate(collection, req, res);
  }

  async bulkUpdate(collection: ICollection, req: any, res?: Response) {
    this.recordMutation('bulk-update', collection, req);
    return this.bulkController.bulkUpdate(collection, req, res);
  }

  async bulkDelete(collection: ICollection, req: any, res?: Response) {
    this.recordMutation('bulk-delete', collection, req);
    return this.bulkController.bulkDelete(collection, req, res);
  }

  async getGlobalActivity(collections: any[], req: Request, res: Response) {
    return this.readController.getGlobalActivity(collections, req, res);
  }

  async getSuggestions(collection: ICollection, req: Request, res: Response) {
    return this.readController.getSuggestions(collection, req, res);
  }

  async export(collection: ICollection, req: Request, res: Response) {
    return this.readController.export(collection, req, res);
  }

  async import(collection: ICollection, req: Request, res: Response) {
    return this.bulkController.import(collection, req, res);
  }

  async getVersions(collection: ICollection, req: any, res: Response) {
    return this.readController.getVersions(collection, req, res);
  }

  async getVersion(collection: ICollection, req: any, res: Response) {
    return this.readController.getVersion(collection, req, res);
  }

  async restoreVersion(collection: ICollection, req: any, res: Response) {
    return this.writeController.restoreVersion(collection, req, res);
  }
}