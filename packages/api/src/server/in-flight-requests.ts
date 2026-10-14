import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Which requests the api is serving right now, so a database pool that fills up can say who is in it.
 *
 * The pool warning used to say only HOW MANY requests were waiting. That cannot answer the question
 * that follows — a scanner, one site's storefront, a plugin route — and the api logs nothing per
 * request at warn level. This keeps the count per site and route while a request is open, and
 * summarises it on demand. Nothing is stored after a request ends.
 */
export class InFlightRequests {
  private static readonly open = new Map<number, { host: string; route: string; startedAt: number }>();
  private static nextId = 0;
  /** How many host+route groups a summary names. */
  static readonly SUMMARY_GROUPS = 5;

  /** Counts the request from its arrival until its response is finished or the connection closes. */
  static middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const id = InFlightRequests.nextId++;
      InFlightRequests.open.set(id, { host: String(req.hostname || ''), route: InFlightRequests.route(req.path), startedAt: Date.now() });
      res.on('close', () => { InFlightRequests.open.delete(id); });
      next();
    };
  }

  /** The path with ids folded away (`/orders/812` and `/orders/9` are one route) and bounded in length. */
  static route(path: string): string {
    return String(path || '/')
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .slice(0, 80);
  }

  /** `in flight 143: site GET /route ×120 (oldest 3.4 s); …`, biggest groups first. */
  static summary(now: number = Date.now()): string {
    const groups = new Map<string, { count: number; oldest: number }>();
    for (const request of InFlightRequests.open.values()) {
      const key = `${request.host} ${request.route}`;
      const group = groups.get(key) ?? { count: 0, oldest: now };
      group.count += 1;
      group.oldest = Math.min(group.oldest, request.startedAt);
      groups.set(key, group);
    }
    const top = [...groups.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, InFlightRequests.SUMMARY_GROUPS)
      .map(([key, group]) => `${key} ×${group.count} (oldest ${((now - group.oldest) / 1000).toFixed(1)} s)`);
    return `In flight ${InFlightRequests.open.size}${top.length ? `: ${top.join('; ')}` : ''}`;
  }

  /** For tests: forget everything. */
  static reset(): void {
    InFlightRequests.open.clear();
  }
}
