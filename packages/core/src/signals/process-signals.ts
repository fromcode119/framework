import { randomUUID } from 'crypto';
import { Logger } from '@core/logging';
import type { ProcessSignal } from '@core/signals/enums/process-signal.enum';
import type { IProcessSignalTransport } from '@core/signals/interfaces/process-signal-transport.interface';

/**
 * Tells every api process that a copy it holds is stale.
 *
 * Caches that live in one process's memory — settings, the site host map, which plugins and themes a
 * site has, the page revision — are forgotten by the process that made the change. Any OTHER process
 * went on serving the old value: until its 5-minute settings poll, or, for the host map and access
 * caches, until it restarted. The hook bus could not carry this: it is local to one process, and
 * broadcasting it would also run every side-effecting hook handler once per process.
 *
 * `announce` forgets locally at once (the caller's own next read is fresh, exactly as before) and
 * publishes to the others through the transport, which each apply with the same handler. With no
 * transport — one process, or no Redis — it is local delivery only, which is all one process needs.
 * A handler learns whether the signal was its own (`local`), for work only the origin should do.
 */
export class ProcessSignals {
  private static readonly logger = new Logger({ namespace: 'process-signals' });
  /** This process, so it can drop its own messages coming back from the transport. */
  static readonly origin = randomUUID();
  private static transport: IProcessSignalTransport | null = null;
  private static readonly handlers = new Map<string, Set<(payload: any, local: boolean) => void>>();

  /** Start carrying signals to and from the other processes. Idempotent per transport. */
  static async use(transport: IProcessSignalTransport): Promise<void> {
    if (ProcessSignals.transport) await ProcessSignals.transport.close().catch(() => undefined);
    ProcessSignals.transport = transport;
    await transport.subscribe((message) => ProcessSignals.receive(message));
  }

  static on(signal: ProcessSignal, handler: (payload: any, local: boolean) => void): () => void {
    const set = ProcessSignals.handlers.get(signal.value) ?? new Set();
    set.add(handler);
    ProcessSignals.handlers.set(signal.value, set);
    return () => set.delete(handler);
  }

  static announce(signal: ProcessSignal, payload: Record<string, unknown> = {}): void {
    ProcessSignals.deliver(signal.value, payload, true);
    const transport = ProcessSignals.transport;
    if (!transport) return;
    const message = JSON.stringify({ origin: ProcessSignals.origin, signal: signal.value, payload });
    // A lost message leaves another process stale until its next refresh — logged, never thrown into
    // the write that caused it, which already succeeded.
    transport.publish(message).catch((error: unknown) =>
      ProcessSignals.logger.error(`Could not tell the other api processes about "${signal.value}": ${String((error as Error)?.message ?? error)}`));
  }

  /** Test seam. */
  static async reset(): Promise<void> {
    if (ProcessSignals.transport) await ProcessSignals.transport.close().catch(() => undefined);
    ProcessSignals.transport = null;
  }

  private static receive(message: string): void {
    let parsed: { origin?: string; signal?: string; payload?: Record<string, unknown> };
    try {
      parsed = JSON.parse(message);
    } catch {
      ProcessSignals.logger.warn('Ignored a process signal that is not JSON.');
      return;
    }
    if (!parsed?.signal || parsed.origin === ProcessSignals.origin) return;
    ProcessSignals.deliver(parsed.signal, parsed.payload ?? {}, false);
  }

  private static deliver(signal: string, payload: Record<string, unknown>, local: boolean): void {
    for (const handler of ProcessSignals.handlers.get(signal) ?? []) {
      try {
        handler(payload, local);
      } catch (error: unknown) {
        ProcessSignals.logger.error(`A "${signal}" handler failed; that copy stays stale until its next refresh: ${String((error as Error)?.message ?? error)}`);
      }
    }
  }
}
