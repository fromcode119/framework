import { HookManager } from '../hooks/hook-manager';
import { Logger } from '../logging';
import { PluginSignatureService } from '../security/plugin-signature-service';
import { WebhooksCollection } from '../collections/webhooks';

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

    private async executeWebhook(webhook: any, event: string, payload: any) {
        this.logger.debug(`Triggering webhook "${webhook.name}" for event "${event}" to ${webhook.url}`);

        const body = JSON.stringify({
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
            headers['X-Fromcode-Signature'] = PluginSignatureService.sign(body, webhook.secret);
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

            // Update stats
            await this.db.update(WebhooksCollection.slug, { id: webhook.id }, {
                lastTriggeredAt: new Date(),
                lastStatus: response.status,
                lastResponse: (await response.text()).substring(0, 1000) // Keep first 1k chars
            });

        } catch (err: any) {
            this.logger.error(`Failed to dispatch webhook ${webhook.name}: ${err.message}`);
            await this.db.update(WebhooksCollection.slug, { id: webhook.id }, {
                lastTriggeredAt: new Date(),
                lastStatus: 0,
                lastResponse: err.message
            });
        }
    }
}