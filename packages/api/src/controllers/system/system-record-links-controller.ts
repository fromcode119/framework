import { Request, Response } from 'express';
import { AppPathConstants, CoreServices, CoercionUtils } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * "What records relate to THIS record?" — the subject-keyed half of entity records.
 *
 * The people routes answer the other half ("what does this person have?"). This one takes an opaque
 * subject — a kind, an id and the correlation keys the record can offer about itself — and returns the
 * contributions of every plugin that declared it understands one of those keys.
 *
 * The framework interprets none of it. It does not know what an order is, which plugin owns one, or
 * what `orderNumber` means; it matches key NAMES and runs the providers that asked for them.
 */
export class SystemRecordLinksController {
  /** Ceiling on how many correlation keys one request may offer, so a URL cannot fan out unbounded. */
  private static readonly MAX_KEYS = 12;
  /** The framework's own correlation keys: people are its records, so it answers for them itself. */
  private static readonly PERSON_ID_KEY = 'personId';
  private static readonly EMAIL_KEY = 'email';
  private static readonly PERSON_PART = 'person';

  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getRecordLinks(req: Request, res: Response) {
    try {
      const kind = CoercionUtils.toString(req.query?.kind).trim();
      const id = CoercionUtils.toString(req.query?.id).trim();
      if (!kind || !id) return res.status(400).json({ error: 'kind and id are required' });

      const keys = SystemRecordLinksController.parseKeys(req.query?.keys);
      if (!keys) return res.status(400).json({ error: 'keys must be a JSON object of string values' });
      if (!Object.keys(keys).length) return res.status(400).json({ error: 'at least one correlation key is required' });

      const result = await CoreServices.getInstance().entityRecordsResolution.resolve({ subject: { kind, id, keys } });
      const person = await this.personItem(keys);
      if (person) {
        result.items.push(person);
        result.groups.push({ group: person.group, items: [person] });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * The person a record names, when it can say who by id or by email. People are the framework's own
   * records — no plugin holds them — so the framework is the one that answers. An email is matched
   * whole, never as a search: a partial match would put a stranger on the record.
   *
   * The keys come from the caller, so this is a person lookup by id or email. It grants nothing new:
   * the route requires `users:view`, the permission the people routes themselves require, and it reads
   * through the same site-bound people service — whoever can ask here can already open that person.
   */
  private async personItem(keys: Record<string, string>): Promise<any | null> {
    const personId = Number(keys[SystemRecordLinksController.PERSON_ID_KEY]);
    const email = CoercionUtils.toString(keys[SystemRecordLinksController.EMAIL_KEY]).trim().toLowerCase();
    let person = personId ? await this.runtime.people.getPerson(personId) : null;
    if (!person && email) {
      const matches = await this.runtime.people.getPeople({ q: email, limit: 20 });
      person = matches.find((candidate: any) => CoercionUtils.toString(candidate?.email).trim().toLowerCase() === email) || null;
    }
    if (!person?.id) return null;
    const name = CoercionUtils.toString(person.displayName).trim() || [person.firstName, person.lastName].map((part: unknown) => CoercionUtils.toString(part).trim()).filter(Boolean).join(' ');
    const mail = CoercionUtils.toString(person.email).trim();
    return {
      id: `person-${person.id}`,
      group: 'Person',
      kind: 'system:person',
      part: SystemRecordLinksController.PERSON_PART,
      title: name || mail || `#${person.id}`,
      subtitle: name ? mail || undefined : undefined,
      href: AppPathConstants.ADMIN.PEOPLE.DETAIL(person.id),
      icon: 'User',
    };
  }

  /** `null` means malformed — distinct from "parsed fine and was empty", which is a different answer. */
  private static parseKeys(raw: unknown): Record<string, string> | null {
    const text = CoercionUtils.toString(raw).trim();
    if (!text) return {};
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Object.keys(out).length >= SystemRecordLinksController.MAX_KEYS) break;
      const key = String(name ?? '').trim();
      const val = CoercionUtils.toString(value).trim();
      if (key && val) out[key] = val;
    }
    return out;
  }
}
