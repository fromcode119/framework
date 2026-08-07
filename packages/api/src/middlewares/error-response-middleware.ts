import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AsyncRouteGuard, EnvUtils, Logger } from '@fromcode119/core';

/**
 * The single place that turns an error reaching Express's error channel into an HTTP response.
 *
 * Two rules, and they are not the same rule:
 *  - An error that CARRIES a client status (a domain error such as `CmsApiError(404, …)`) answers with
 *    that status and its own message. Carrying a 4xx is the author stating the message is for the
 *    caller.
 *  - Anything else — an unrecognised throw, or an error carrying a 5xx — answers 500 with a generic
 *    body. The real message and stack go to the server log only, together with the plugin slug and the
 *    route that produced them (see {@link AsyncRouteGuard.originOf}), so an operator can find the
 *    offending plugin without the client learning anything about internals.
 */
export class ErrorResponseMiddleware {
  private static readonly CLIENT_STATUS_MIN = 400;
  private static readonly CLIENT_STATUS_MAX = 499;
  private static readonly SERVER_STATUS = 500;
  private static readonly GENERIC_MESSAGE = 'An unexpected error occurred';

  constructor(private readonly logger: Logger) {}

  middleware(): ErrorRequestHandler {
    return (error: unknown, req: Request, res: Response, next: NextFunction) => {
      if (this.isPayloadTooLarge(error)) {
        res.status(413).json({
          error: 'Payload Too Large',
          message:
            'Request body is too large. Reduce staged action payload size or increase API_JSON_BODY_LIMIT.',
        });
        return;
      }

      this.log(error, req);

      // The handler began streaming and then failed. Nothing can be added to the body; hand back to
      // Express so it closes the connection.
      if (res.headersSent) {
        next(error);
        return;
      }

      this.applyCorsHeaders(req, res);

      const status = this.resolveStatus(error);
      res.status(status).json({
        error: this.titleFor(status),
        message: this.messageFor(status, error),
      });
    };
  }

  /**
   * A 4xx on the error is a deliberate, client-facing status. A 5xx (or no status at all) is not — it
   * collapses to 500 so a plugin cannot accidentally publish an internal failure code.
   */
  private resolveStatus(error: unknown): number {
    const status = this.readStatus(error);
    if (
      status >= ErrorResponseMiddleware.CLIENT_STATUS_MIN &&
      status <= ErrorResponseMiddleware.CLIENT_STATUS_MAX
    ) {
      return status;
    }
    return ErrorResponseMiddleware.SERVER_STATUS;
  }

  private messageFor(status: number, error: unknown): string {
    if (status !== ErrorResponseMiddleware.SERVER_STATUS) {
      return this.readMessage(error) || ErrorResponseMiddleware.GENERIC_MESSAGE;
    }
    // 500 leaks nothing to the client. In development the real message is useful at the console, and
    // the server log below has it in every environment.
    return EnvUtils.isDevelopment()
      ? this.readMessage(error) || ErrorResponseMiddleware.GENERIC_MESSAGE
      : ErrorResponseMiddleware.GENERIC_MESSAGE;
  }

  private titleFor(status: number): string {
    return status === ErrorResponseMiddleware.SERVER_STATUS ? 'Internal Server Error' : 'Request Failed';
  }

  private log(error: unknown, req: Request): void {
    const origin = AsyncRouteGuard.originOf(error);
    const where = origin
      ? `${origin.source} ${origin.method} ${origin.path}`
      : `${String(req.method || '')} ${String(req.originalUrl || req.path || '')}`;

    this.logger.error(`Unhandled route error [${where}]: ${this.readMessage(error)}`, {
      stack: this.readStack(error),
      source: origin?.source,
      path: String(req.originalUrl || req.path || ''),
      status: this.readStatus(error) || undefined,
    });
  }

  private applyCorsHeaders(req: Request, res: Response): void {
    const origin = req.headers.origin;
    if (!origin) {
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Framework-Client, X-CSRF-Token, X-Reset-Context'
    );
  }

  private isPayloadTooLarge(error: unknown): boolean {
    return this.readStatus(error) === 413 || this.readProperty(error, 'type') === 'entity.too.large';
  }

  private readStatus(error: unknown): number {
    const raw = this.readProperty(error, 'status') ?? this.readProperty(error, 'statusCode');
    const status = Number(raw);
    return Number.isFinite(status) ? status : 0;
  }

  private readMessage(error: unknown): string {
    return String(this.readProperty(error, 'message') ?? error ?? '');
  }

  private readStack(error: unknown): string {
    return String(this.readProperty(error, 'stack') ?? '');
  }

  private readProperty(error: unknown, key: string): unknown {
    if (!error || typeof error !== 'object') {
      return undefined;
    }
    return Reflect.get(error as object, key);
  }
}
