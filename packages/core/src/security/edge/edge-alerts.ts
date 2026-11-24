import { Logger } from '@core/logging';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';
import { FrameworkAdminAlerts } from '@core/email/framework-admin-alerts';
import type { IEdgeStopRecord } from '@core/security/edge/interfaces/edge-stop-record.interface';

/**
 * Tells the platform's administrators what the gateway did on its own (the "Edge security" alert, which
 * each of them can switch off in their profile): it stopped a scanner, or its watchdog restarted it.
 *
 * Scanners come in waves of hundreds of addresses, so a stop is not a message each: the first stop after
 * a quiet {@link WINDOW_MS} is sent at once, and the stops that follow inside the window are gathered and
 * sent together when it ends. The list in Settings → Security → Stopped addresses is always complete; the
 * message only says to look. A watchdog restart is rare and means the sites were down, so it is always sent.
 */
export class EdgeAlerts {
  static readonly WINDOW_MS = 60 * 60_000;
  private static readonly SCANNER_TEMPLATE = 'edge-scanner-stopped';
  private static readonly RESTART_TEMPLATE = 'gateway-restarted';
  private static readonly AUTHORITY_TEMPLATE = 'edge-authority-expiring';
  /** Stops named in one message; the rest are counted. */
  private static readonly LISTED = 20;

  private readonly logger = new Logger({ namespace: 'edge-alerts' });
  /** When the last scanner message went; null before the first. */
  private lastSentAt: number | null = null;
  private pending: IEdgeStopRecord[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly manager: any,
    private readonly now: () => number = Date.now,
    private readonly send: (message: { subject: string; text: string; html: string }) => Promise<unknown> = (message) =>
      NotificationsContextProxy.createNotificationsProxy(this.manager, 'system').notifyAdmins(message, { category: FrameworkAdminAlerts.EDGE_SECURITY }),
  ) {}

  /** A new stop. Sent now, or gathered until the window ends. */
  async scannerStopped(stop: IEdgeStopRecord): Promise<void> {
    this.pending.push(stop);
    const wait = this.lastSentAt === null ? 0 : this.lastSentAt + EdgeAlerts.WINDOW_MS - this.now();
    if (wait <= 0) return this.flush();
    this.timer ??= setTimeout(() => { this.timer = null; void this.flush(); }, wait);
    this.timer.unref?.();
  }

  async gatewayRestarted(reason: string, at: string): Promise<void> {
    await this.deliver(EdgeAlerts.RESTART_TEMPLATE, { reason: reason || 'not given', at });
  }

  /** The root every edge is checked against runs out soon (30 and 14 days ahead). */
  async authorityExpiring(notAfter: Date, daysLeft: number): Promise<void> {
    await this.deliver(EdgeAlerts.AUTHORITY_TEMPLATE, { notAfter: notAfter.toISOString().slice(0, 10), daysLeft });
  }

  /** Sends what is gathered, if anything. */
  async flush(): Promise<void> {
    if (!this.pending.length) return;
    const stops = this.pending;
    this.pending = [];
    this.lastSentAt = this.now();
    await this.deliver(EdgeAlerts.SCANNER_TEMPLATE, {
      isSingle: stops.length === 1,
      address: stops[0].address,
      count: stops.length,
      windowMinutes: Math.round(EdgeAlerts.WINDOW_MS / 60_000),
      stops: stops.slice(0, EdgeAlerts.LISTED).map((stop) => ({
        address: stop.address,
        until: stop.until.replace('T', ' ').slice(0, 16) + ' UTC',
        hosts: stop.hosts.join(', '),
        paths: stop.paths.join(', '),
      })),
    });
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Rendered and sent; any failure is logged, never thrown — the stop or restart is already recorded. */
  private async deliver(template: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.send(PluginEmailTemplateFileService.renderEmail(template, data));
    } catch (error: any) {
      this.logger.warn(`Could not send the edge alert "${template}": ${error?.message || error}`);
    }
  }
}
