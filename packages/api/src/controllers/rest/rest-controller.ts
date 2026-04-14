import { Request, Response } from 'express';
import { AuthManager } from '@fromcode119/auth';
import { Collection, HookManager } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';
import { RestBulkController } from './rest-bulk-controller';
import { RestControllerRuntime } from './rest-controller-runtime';
import { RestReadController } from './rest-read-controller';
import { RestWriteController } from './rest-write-controller';

export class RESTController {
  private readonly runtime: RestControllerRuntime;
  private readonly readController: RestReadController;
  private readonly writeController: RestWriteController;
  private readonly bulkController: RestBulkController;

  constructor(
    db: IDatabaseManager,
    auth?: AuthManager,
    onSettingsUpdate?: (key: string, value: any) => void,
    hooks?: HookManager
  ) {
    this.runtime = new RestControllerRuntime(db, auth, onSettingsUpdate, hooks);
    this.readController = new RestReadController(this.runtime);
    this.writeController = new RestWriteController(this.runtime);
    this.bulkController = new RestBulkController(this.runtime);
  }

  async find(collection: Collection, req: any, res?: Response) {
    return this.readController.find(collection, req, res);
  }

  async findOne(collection: Collection, req: any, res?: Response) {
    return this.readController.findOne(collection, req, res);
  }

  async create(collection: Collection, req: any, res?: Response) {
    return this.writeController.create(collection, req, res);
  }

  async update(collection: Collection, req: any, res?: Response) {
    return this.writeController.update(collection, req, res);
  }

  async delete(collection: Collection, req: any, res?: Response) {
    return this.writeController.delete(collection, req, res);
  }

  async bulkCreate(collection: Collection, req: any, res?: Response) {
    return this.bulkController.bulkCreate(collection, req, res);
  }

  async bulkUpdate(collection: Collection, req: any, res?: Response) {
    return this.bulkController.bulkUpdate(collection, req, res);
  }

  async bulkDelete(collection: Collection, req: any, res?: Response) {
    return this.bulkController.bulkDelete(collection, req, res);
  }

  async getGlobalActivity(collections: any[], req: Request, res: Response) {
    return this.readController.getGlobalActivity(collections, req, res);
  }

  async getSuggestions(collection: Collection, req: Request, res: Response) {
    return this.readController.getSuggestions(collection, req, res);
  }

  async export(collection: Collection, req: Request, res: Response) {
    return this.readController.export(collection, req, res);
  }

  async import(collection: Collection, req: Request, res: Response) {
    return this.bulkController.import(collection, req, res);
  }

  async getVersions(collection: Collection, req: any, res: Response) {
    return this.readController.getVersions(collection, req, res);
  }

  async getVersion(collection: Collection, req: any, res: Response) {
    return this.readController.getVersion(collection, req, res);
  }

  async restoreVersion(collection: Collection, req: any, res: Response) {
    return this.writeController.restoreVersion(collection, req, res);
  }
}