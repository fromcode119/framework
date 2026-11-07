import { Logger } from '@fromcode119/core';

/**
 * What the edge writes about a connection — only what NO gateway can log, because the gateway never saw it.
 *
 * The edge passes raw TCP (on 443 still encrypted), so it knows a port, not a host or a path. A connection
 * a gateway took gets its full line in that gateway's access log (`gateway:http`); writing it here as well
 * would only say the same request twice, with less in it. So the edge writes (namespace `edge:conn`):
 *
 * - `dropped` (warn) — no gateway accepted it after every attempt: the visitor got a closed connection and
 *   nothing else will ever record that they came.
 * - `retried` (info) — it reached a gateway only after another refused it, during a deploy or a lossy link.
 *
 * A visitor who hangs up while the edge is still looking needs no line of its own: the edge does not read
 * from a connection until a gateway takes it, so the hang-up reaches that gateway, which logs the request
 * as `aborted` — or no gateway took it, and the line is `dropped`.
 *
 * The visitor's address is not written: the gateway lines do not carry it either, and it identifies a person.
 */
export class EdgeConnectionLog {
  private static readonly logger = new Logger({ namespace: 'edge:conn' });

  dropped(port: number, startedAt: number, tried: ReadonlySet<string>, attempts: number): void {
    EdgeConnectionLog.logger.warn(`:${port} dropped ${Date.now() - startedAt}ms — no gateway accepted it after ${attempts} attempt(s), tried ${EdgeConnectionLog.list(tried)}`);
  }

  retried(port: number, startedAt: number, address: string, refused: ReadonlySet<string>, attempts: number): void {
    EdgeConnectionLog.logger.info(`:${port} retried ${Date.now() - startedAt}ms — reached ${address} on attempt ${attempts}, refused by ${EdgeConnectionLog.list(refused)}`);
  }

  private static list(addresses: ReadonlySet<string>): string {
    return addresses.size ? [...addresses].join(', ') : 'none (no gateway known)';
  }
}
