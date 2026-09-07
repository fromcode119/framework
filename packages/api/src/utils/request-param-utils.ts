import { Request, Response } from 'express';
import { CoercionUtils } from '@fromcode119/core';

/**
 * Route-parameter reads that reject the request themselves.
 *
 * `CoercionUtils.toRelationId` returns `null` for anything that is not a usable record id, and every
 * controller then repeated the same three lines to turn that `null` into a `400`. The coercion belongs to
 * core; SENDING the rejection is an HTTP concern, so it lives here rather than on `CoercionUtils`.
 *
 * A caller reads: `const id = RequestParamUtils.relationId(req, res, 'person'); if (id === null) return;`
 * — the response is already written when `null` comes back, so the caller only returns.
 */
export class RequestParamUtils {
  /** `req.params.<name>` as a record id, or `null` after answering `400 Invalid <label> id`. */
  static relationId(req: Request, res: Response, label: string, name = 'id'): number | null {
    const id = CoercionUtils.toRelationId((req?.params as Record<string, unknown> | undefined)?.[name]);
    if (id === null) {
      res.status(400).json({ error: `Invalid ${label} id` });
    }
    return id;
  }
}
