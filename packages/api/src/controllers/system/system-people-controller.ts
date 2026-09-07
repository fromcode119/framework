import { Request, Response } from 'express';
import { RequestParamUtils } from '@api/utils/request-param-utils';
import { CoreServices } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { CoercionUtils } from '@fromcode119/core';

/** Admin endpoints for the unified `people` model: list people and promote a person to a login account. */
export class SystemPeopleController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  /**
   * Recipient suggestions for the share composer. Same `users:view` permission as the other people
   * routes — this is the people directory, just projected down to what a picker needs.
   */
  async suggestRecipients(req: Request, res: Response) {
    try {
      res.json({ docs: await this.runtime.people.suggestRecipients({ q: CoercionUtils.toString(req.query?.q), limit: Number(req.query.limit) || undefined }) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPeople(req: Request, res: Response) {
    try {
      res.json({ docs: await this.runtime.people.getPeople({ q: CoercionUtils.toString(req.query?.q), limit: Number(req.query.limit) || undefined }) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPerson(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      const person = await this.runtime.people.getPerson(id);
      if (!person) return res.status(404).json({ error: 'Person not found' });
      res.json({ person });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Aggregate every plugin-registered record for this person into one grouped
   * timeline (invoices, declarations, agreements, orders, …) — the Person 360
   * / partner-CRM data source. Runs each provider in isolation; one failing
   * provider surfaces an error entry but never breaks the response.
   */
  async getPersonRecords(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      const person = await this.runtime.people.getPerson(id);
      if (!person) return res.status(404).json({ error: 'Person not found' });

      const result = await CoreServices.getInstance().entityRecordsResolution.resolve({
        personId: person.id,
        userId: person.userId ?? null,
        email: person.email ?? null,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Aggregate records by a flexible reference (userId / email / personId) instead
   * of a resolved person id — used to embed the records hub on plugin record detail
   * pages (a domain record keyed by its login user) without first resolving
   * the person. Providers match on userId/email, so a person row is not required.
   */
  async getRecordsByRef(req: Request, res: Response) {
    try {
      const userId = CoercionUtils.toString(req.query?.userId) || null;
      const email = CoercionUtils.toString(req.query?.email) || null;
      const personId = CoercionUtils.toString(req.query?.personId) || null;
      if (userId == null && !email && personId == null) {
        return res.status(400).json({ error: 'userId, email or personId is required' });
      }
      const result = await CoreServices.getInstance().entityRecordsResolution.resolve({ personId, userId, email });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async savePerson(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      const person = await this.runtime.people.savePerson(id, req.body || {});
      res.json({ success: true, person });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async createUserFromPerson(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      const result = await this.runtime.people.createUserFromPerson(id, req.body || {});
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePerson(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      await this.runtime.people.deletePerson(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async linkUser(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'person');
      if (id === null) return;
      const rawUserId = (req.body || {}).userId;
      const userId = rawUserId == null || rawUserId === '' ? null : parseInt(String(rawUserId), 10);
      const person = await this.runtime.people.linkUser(id, userId);
      res.json({ success: true, person });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
