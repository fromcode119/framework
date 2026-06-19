import { Request, Response } from 'express';
import { CoreServices } from '@fromcode119/core';
import { SystemControllerRuntime } from './system-controller-runtime';

/** Admin endpoints for the unified `people` model: list people and promote a person to a login account. */
export class SystemPeopleController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getPeople(req: Request, res: Response) {
    try {
      res.json({ docs: await this.runtime.people.getPeople() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPerson(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid person id' });
      }
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
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid person id' });
      }
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
   * pages (e.g. an MLM affiliate, keyed by its login user) without first resolving
   * the person. Providers match on userId/email, so a person row is not required.
   */
  async getRecordsByRef(req: Request, res: Response) {
    try {
      const userId = req.query.userId != null && req.query.userId !== '' ? String(req.query.userId) : null;
      const email = req.query.email != null && req.query.email !== '' ? String(req.query.email) : null;
      const personId = req.query.personId != null && req.query.personId !== '' ? String(req.query.personId) : null;
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
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid person id' });
      }
      const person = await this.runtime.people.savePerson(id, req.body || {});
      res.json({ success: true, person });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async createUserFromPerson(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid person id' });
      }
      const result = await this.runtime.people.createUserFromPerson(id, req.body || {});
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
