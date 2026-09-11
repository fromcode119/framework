import { AttentionItem } from '@core/services/attention/attention-item';
import { AttentionSeverity } from '@core/services/attention/attention-severity.enum';
import { PluginAttentionRegistryService } from '@core/services/attention/plugin-attention-registry-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { AppPathConstants } from '@core/constants/app-path.constants';
import { Logger } from '@core/logging';

/**
 * Everything that needs the operator, in one list: the framework's own checks plus whatever the
 * plugins say is unfinished.
 *
 * The framework's checks are deliberately about the PLATFORM — a plugin that will not load, a
 * webhook that will not deliver. What counts as unfinished WORK is domain knowledge, so it arrives
 * through the registry; core never learns what an order is.
 *
 * A provider that throws or hangs must not take the dashboard with it: each is awaited with a
 * timeout, failures are logged and skipped, and the rest of the list still renders.
 */
export class AttentionResolutionService {
  private static readonly PROVIDER_TIMEOUT_MS = 2_000;
  private static readonly WEBHOOK_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
  private static readonly MAX_ITEMS = 12;

  private readonly logger = new Logger({ namespace: 'attention' });

  constructor(
    private readonly registry: PluginAttentionRegistryService,
    private readonly deps: {
      listPlugins: () => Array<{ manifest?: { slug?: string; name?: string }; state?: unknown; error?: string }>;
      countWebhookFailures: (since: Date) => Promise<number>;
    },
  ) {}

  async list(): Promise<AttentionItem[]> {
    const items = [...this.platformItems(), ...(await this.pluginItems())];
    return items
      .sort((left, right) => left.severity.rank - right.severity.rank)
      .slice(0, AttentionResolutionService.MAX_ITEMS);
  }

  /** Core's own checks: a plugin that failed to register, and deliveries that are not arriving. */
  private platformItems(): AttentionItem[] {
    const items: AttentionItem[] = [];

    for (const plugin of this.deps.listPlugins() || []) {
      if (PluginState.resolve(plugin?.state) !== PluginState.ERROR) continue;
      const slug = String(plugin?.manifest?.slug || '').trim();
      items.push(AttentionItem.from({
        key: `plugin-error:${slug}`,
        title: `${plugin?.manifest?.name || slug} failed to register`,
        detail: String(plugin?.error || '').slice(0, 160),
        severity: AttentionSeverity.CRITICAL.value,
        actionLabel: 'Open log',
        actionPath: AppPathConstants.ADMIN.ACTIVITY,
      }, 'system')!);
    }

    return items.filter(Boolean);
  }

  private async pluginItems(): Promise<AttentionItem[]> {
    const results = await Promise.all(this.registry.list().map(async (provider) => {
      try {
        const raw = await this.withTimeout(provider.resolve(), provider.canonicalKey);
        return (Array.isArray(raw) ? raw : [])
          .map((entry) => AttentionItem.from(entry, provider.pluginSlug))
          .filter((item): item is AttentionItem => item !== null);
      } catch (error) {
        this.logger.warn(`Attention provider ${provider.canonicalKey} failed: ${error}`);
        return [];
      }
    }));
    return results.flat();
  }

  private async withTimeout(value: Promise<unknown[]> | unknown[], key: string): Promise<unknown[]> {
    if (!(value instanceof Promise)) return value;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        value,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timed out after ${AttentionResolutionService.PROVIDER_TIMEOUT_MS}ms`)),
            AttentionResolutionService.PROVIDER_TIMEOUT_MS,
          );
        }),
      ]) as unknown[];
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Exposed so the api can add the webhook check without this service knowing the database. */
  async webhookFailureItem(): Promise<AttentionItem | null> {
    const since = new Date(Date.now() - AttentionResolutionService.WEBHOOK_FAILURE_WINDOW_MS);
    const failures = await this.deps.countWebhookFailures(since);
    if (!failures) return null;
    return AttentionItem.from({
      key: 'webhook-failures',
      title: `${failures} webhook ${failures === 1 ? 'delivery' : 'deliveries'} failed in the last 24 hours`,
      detail: 'The receiving endpoint answered with an error or did not answer.',
      severity: AttentionSeverity.WARNING.value,
      actionLabel: 'Webhooks',
      actionPath: AppPathConstants.ADMIN.SETTINGS.INFRASTRUCTURE,
    }, 'system');
  }
}
