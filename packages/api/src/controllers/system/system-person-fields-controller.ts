import { Request, Response } from 'express';
import { PersonFieldService, PersonFieldValueError } from '@fromcode119/core';
import { RequestParamUtils } from '@api/utils/request-param-utils';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/** Admin endpoints for People → Fields: the site's field declarations and one person's values. */
export class SystemPersonFieldsController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  private fields(): PersonFieldService {
    return new PersonFieldService(this.runtime.db as any);
  }

  /** A value that does not fit its field is the caller's mistake: 400 with the field key to point at. */
  static fail(res: Response, error: any) {
    if (error instanceof PersonFieldValueError) return res.status(400).json({ error: 'invalidField', field: error.field, reason: error.reason });
    return res.status(500).json({ error: error.message });
  }

  async list(_req: Request, res: Response) {
    try {
      res.json({ docs: await this.fields().list() });
    } catch (error: any) {
      SystemPersonFieldsController.fail(res, error);
    }
  }

  async save(req: Request, res: Response) {
    try {
      res.json({ field: await this.fields().save(req.body || {}) });
    } catch (error: any) {
      SystemPersonFieldsController.fail(res, error);
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const removed = await this.fields().remove(String(req.params.key ?? ''));
      if (!removed) return res.status(404).json({ error: 'Field not found' });
      res.json({ success: true });
    } catch (error: any) {
      SystemPersonFieldsController.fail(res, error);
    }
  }

  async values(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      res.json({ values: await this.fields().values(Number(id)) });
    } catch (error: any) {
      SystemPersonFieldsController.fail(res, error);
    }
  }

  async setValues(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      if (!(await this.runtime.people.getPerson(id))) return res.status(404).json({ error: 'Person not found' });
      res.json({ values: await this.fields().setValues(Number(id), req.body?.values || {}) });
    } catch (error: any) {
      SystemPersonFieldsController.fail(res, error);
    }
  }
}
