import { Request, Response } from 'express';
import { CoreServices, CoercionUtils } from '@fromcode119/core';

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

  async getRecordLinks(req: Request, res: Response) {
    try {
      const kind = CoercionUtils.toString(req.query?.kind).trim();
      const id = CoercionUtils.toString(req.query?.id).trim();
      if (!kind || !id) return res.status(400).json({ error: 'kind and id are required' });

      const keys = SystemRecordLinksController.parseKeys(req.query?.keys);
      if (!keys) return res.status(400).json({ error: 'keys must be a JSON object of string values' });
      if (!Object.keys(keys).length) return res.status(400).json({ error: 'at least one correlation key is required' });

      const result = await CoreServices.getInstance().entityRecordsResolution.resolve({ subject: { kind, id, keys } });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
