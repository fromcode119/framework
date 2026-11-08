import { AsyncLocalStorage } from 'async_hooks';
import { performance } from 'perf_hooks';
import type { Request, Response, NextFunction } from 'express';
import { CookieConstants } from '@core/constants/cookie.constants';

interface IStepTotal {
  ms: number;
  count: number;
}

/** What one request records: when it began, and the time each named step took. */
class Recorder {
  readonly began = performance.now();
  readonly steps = new Map<string, IStepTotal>();
  handlerReached = false;

  add(name: string, ms: number): void {
    const total = this.steps.get(name) ?? { ms: 0, count: 0 };
    total.ms += ms;
    total.count += 1;
    this.steps.set(name, total);
  }
}

/**
 * Where the time of one request went, reported in its `Server-Timing` header.
 *
 * Everything that makes an answer slow lives in steps nobody could see: the middleware before a route,
 * the hop into a plugin's process, the platform calls a plugin makes back, a scan across collections.
 * A step is timed where it runs (`step`, `record`) and every one a request made is written once, as the
 * response starts. Without an open request nothing is recorded, so a job or a boot pays nothing.
 *
 * WHO IS TOLD. The header carries durations and the number of times a step ran — never a value, a
 * path or a name taken from the request. It is still not for everybody: only an anonymous read of a
 * public address gets it. A signed-in caller, a write, and anything under `/auth` do not: how many
 * queries a login ran would tell a stranger whether an account exists. An answer from a plugin process
 * that carries its own `Server-Timing` is held to the same rule and loses it for those callers.
 */
export class RequestServerTiming {
  private static readonly storage = new AsyncLocalStorage<Recorder>();

  /** A step name is a short token the header can carry as is; anything else is not recorded. */
  private static readonly NAME = /^[a-z][a-z0-9-]{0,39}$/;

  /** The credentials a request can carry other than a cookie. */
  private static readonly CREDENTIAL_HEADERS = ['authorization', 'x-api-key'] as const;

  private static readonly PERSONAL_COOKIES: ReadonlySet<string> = new Set<string>([...CookieConstants.AUTH_COOKIES_TO_CLEAR, CookieConstants.SITE_PREVIEW]);

  /**
   * Express middleware: opens a recorder for the request and writes the header as the response starts.
   * `gated: false` is for a plugin process, which only reports to the api that called it — the api
   * decides, for the caller it faces, whether anything reaches the browser. `totalAs` names a step that
   * is everything from the request's arrival to the response starting.
   */
  static middleware(options: { gated: boolean; totalAs?: string } = { gated: true }) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const recorder = new Recorder();
      const writeHead = res.writeHead;
      (res as { writeHead: unknown }).writeHead = function (this: Response, ...args: unknown[]): Response {
        if (options.totalAs) RequestServerTiming.add(recorder, options.totalAs, performance.now() - recorder.began);
        RequestServerTiming.write(req, res, recorder, options.gated);
        return (writeHead as (...rest: unknown[]) => Response).apply(this, args);
      };
      RequestServerTiming.storage.run(recorder, () => next());
    };
  }

  /** Times `work` as the step `name`. */
  static async step<T>(name: string, work: () => Promise<T>): Promise<T> {
    const recorder = RequestServerTiming.storage.getStore();
    if (!recorder) return work();
    const started = performance.now();
    try {
      return await work();
    } finally {
      RequestServerTiming.add(recorder, name, performance.now() - started);
    }
  }

  /** Adds `ms` to the step `name`. */
  static record(name: string, ms: number): void {
    const recorder = RequestServerTiming.storage.getStore();
    if (recorder) RequestServerTiming.add(recorder, name, ms);
  }

  /** The request reached the code that answers it: what came before is the platform's own work (`api-pre`). Once per request. */
  static handlerReached(): void {
    const recorder = RequestServerTiming.storage.getStore();
    if (!recorder || recorder.handlerReached) return;
    recorder.handlerReached = true;
    RequestServerTiming.add(recorder, 'api-pre', performance.now() - recorder.began);
  }

  /** The header value for what is recorded so far; '' when nothing is. */
  static format(recorder: { steps: ReadonlyMap<string, IStepTotal> }): string {
    return [...recorder.steps.entries()]
      .map(([name, total]) => `${name};dur=${total.ms.toFixed(1)}${total.count > 1 ? `;desc="${total.count}x"` : ''}`)
      .join(', ');
  }

  /** Whether this caller may be told. */
  static allows(req: Pick<Request, 'method' | 'headers'> & { originalUrl?: string; user?: unknown }): boolean {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (req.user) return false;
    for (const header of RequestServerTiming.CREDENTIAL_HEADERS) if (req.headers[header]) return false;
    if (/^\/api(\/v\d+)?\/auth(\/|\?|$)/.test(String(req.originalUrl ?? ''))) return false;
    const cookies = String(req.headers.cookie ?? '');
    if (cookies) {
      for (const pair of cookies.split(';')) {
        if (RequestServerTiming.PERSONAL_COOKIES.has(pair.split('=')[0].trim())) return false;
      }
    }
    return true;
  }

  private static add(recorder: Recorder, name: string, ms: number): void {
    if (RequestServerTiming.NAME.test(name) && Number.isFinite(ms) && ms >= 0) recorder.add(name, ms);
  }

  private static write(req: Request, res: Response, recorder: Recorder, gated: boolean): void {
    if (res.headersSent) return;
    if (gated && !RequestServerTiming.allows(req)) {
      // A plugin process answered with timings of its own: they are held to the same rule.
      res.removeHeader('Server-Timing');
      return;
    }
    const mine = RequestServerTiming.format(recorder);
    if (!mine) return;
    const existing = res.getHeader('Server-Timing');
    const kept = Array.isArray(existing) ? existing.join(', ') : existing ? String(existing) : '';
    res.setHeader('Server-Timing', kept ? `${kept}, ${mine}` : mine);
  }
}
