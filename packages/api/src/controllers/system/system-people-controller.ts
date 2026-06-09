import { Request, Response } from 'express';
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
