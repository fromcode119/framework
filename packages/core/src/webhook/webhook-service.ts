import { HookManager } from '../hooks/hook-manager';
import { Logger } from '../logging';
import { PluginSignatureService } from '../security/plugin-signature-service';
import { SecretService } from '../security/secret-service';
import { HookEventUtils } from '../hook-events';
import { WebhooksCollection } from '../collections/webhooks';
import { SystemConstants } from '../constants';

export class WebhookService {
    private logger = new Logger({ namespace: 'webhook-service' });
    private db: any;
    private hooks: HookManager;
    private webhooksCache: any[] = [];
    private lastCacheUpdate: number = 0;
    private CACHE_TTL = 30000; // 30 seconds

    constructor(db: any, hooks: HookManager) {
        this.db = db;
        this.hooks = hooks;
    }

    public async initialize() {
        this.logger.info('Initializing Webhook Service...');
        
        // Listen to ALL events by using a broad wildcard if possible, 
        // or we can hook into have the HookManager call us.
        // For now, let's use a special hook that PluginManager or other services can use,
        // or just subscribe to a very broad pattern.
        
        // Since HookManager doesn't support a simple "catch-all", 
        // we'll modify PluginManager to call us, or we'll register individual listeners.
        // Actually, a better way is to have HookManager support a middleware or a global listener.
        
        await this.refreshCache();

        this.hooks.on(HookEventUtils.beforeSave(WebhooksCollection.slug), (payload: any) => {
            if (payload?.secret && !SecretService.isEncryptedValue(payload.secret)) {
                payload.secret = SecretService.encrypt(payload.secret);
            }
            return payload;
        });
    }

    private async refreshCache() {
        try {
            this.webhooksCache = await this.db.find(WebhooksCollection.slug, {
                where: { active: true }
            });
            this.lastCacheUpdate = Date.now();
        } catch (err) {
            this.logger.error('Failed to refresh webhooks cache:', err);
        }
    }

    public async processEvent(event: string, payload: any) {
        if (Date.now() - this.lastCacheUpdate > this.CACHE_TTL) {
            await this.refreshCache();
        }

        if (!this.webhooksCache || this.webhooksCache.length === 0) return;

        for (const webhook of this.webhooksCache) {
            const events = Array.isArray(webhook.events) ? webhook.events : [];
            const isMatch = events.some((pattern: string) => this.matchEvent(pattern, event));

            if (isMatch) {
                // Execute in background
                this.executeWebhook(webhook, event, payload).catch(err => {
                    this.logger.error(`Webhook ${webhook.name} failed:`, err);
                });
            }
        }
    }

    private matchEvent(pattern: string, event: string): boolean {
        if (pattern === event) return true;
        if (pattern === '*') return true;
        
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(event);
    }

    private async executeWebhook(webhook: any, event: string, payload: any, prebuiltBody?: string) {
        this.logger.debug(`Triggering webhook "${webhook.name}" for event "${event}" to ${webhook.url}`);

        const body = prebuiltBody ?? JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            payload
        });

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Fromcode-Event': event,
            'X-Fromcode-Delivery': Math.random().toString(36).substring(7),
            ...(webhook.headers || {})
        };

        if (webhook.secret) {
            const rawSecret = SecretService.decrypt(webhook.secret);
            headers['X-Fromcode-Signature'] = PluginSignatureService.sign(body, rawSecret);
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(webhook.url, {
                method: webhook.method || 'POST',
                headers,
                body: webhook.method !== 'GET' ? body : undefined,
                signal: controller.signal
            });

            clearTimeout(timeout);
            const text = (await response.text()).substring(0, 1000);

            // Update stats
            await this.db.update(WebhooksCollection.slug, { id: webhook.id }, {
                lastTriggeredAt: new Date(),
                lastStatus: response.status,
                lastResponse: text
            });
            await this.logDelivery(webhook.id, event, response.status, response.ok, text, body);

        } catch (err: any) {
            this.logger.error(`Failed to dispatch webhook ${webhook.name}: ${err.message}`);
            await this.db.update(WebhooksCollection.slug, { id: webhook.id }, {
                lastTriggeredAt: new Date(),
                lastStatus: 0,
                lastResponse: err.message
            });
            await this.logDelivery(webhook.id, event, 0, false, String(err.message || 'error'), body);
        }
    }

    /** Append a delivery-log row (best-effort; the delivery itself never fails on a log error). */
    private async logDelivery(webhookId: number, event: string, status: number, ok: boolean, response: string, requestBody: string) {
        try {
            await this.db.insert(SystemConstants.TABLE.WEBHOOK_DELIVERIES, {
                webhook_id: webhookId, event, status, ok: ok ? 1 : 0,
                response: String(response || '').substring(0, 1000),
                request_body: String(requestBody || '').substring(0, 4000),
            });
        } catch (err) {
            this.logger.error('Failed to write webhook delivery log:', err);
        }
    }

    /** Fire a synthetic test event at ONE webhook (bypasses the active/event-match filters). */
    public async testWebhook(webhookId: number): Promise<{ success: boolean; error?: string }> {
        const webhook = await this.db.findOne(WebhooksCollection.slug, { id: Number(webhookId) }).catch(() => null);
        if (!webhook) return { success: false, error: 'webhook_not_found' };
        await this.executeWebhook(webhook, 'system:webhook:test', { message: 'Test delivery from Fromcode.', at: new Date().toISOString() });
        return { success: true };
    }

    /** Re-send a past delivery using its stored request body against its (current) webhook config. */
    public async resendDelivery(deliveryId: number): Promise<{ success: boolean; error?: string }> {
        const delivery = await this.db.findOne(SystemConstants.TABLE.WEBHOOK_DELIVERIES, { id: Number(deliveryId) }).catch(() => null);
        if (!delivery) return { success: false, error: 'delivery_not_found' };
        const record = (delivery as any);
        const webhook = await this.db.findOne(WebhooksCollection.slug, { id: Number(record.webhookId ?? record.webhook_id) }).catch(() => null);
        if (!webhook) return { success: false, error: 'webhook_not_found' };
        await this.executeWebhook(webhook, String(record.event || 'resend'), null, String(record.requestBody ?? record.request_body ?? ''));
        return { success: true };
    }

    /** Recent deliveries, newest first — the whole log or scoped to one webhook. */
    public async listDeliveries(webhookId?: number, limit = 50): Promise<any[]> {
        const where = webhookId ? { webhook_id: Number(webhookId) } : {};
        const rows = await this.db.find(SystemConstants.TABLE.WEBHOOK_DELIVERIES, { where, orderBy: { id: 'desc' }, limit }).catch(() => []);
        return Array.isArray(rows) ? rows : [];
    }
}