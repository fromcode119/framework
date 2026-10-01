import { CoercionUtils } from '@core/utils/coercion-utils';
import type { ISmsSender } from '@core/notifications/interfaces/sms-sender.interface';

/**
 * A provider plugin's sender. The plugin hands over a `send(config, message)` function — not an object,
 * because a plugin runs in its own process and only a function survives the trip — and the site's
 * saved settings for it (credentials decrypted by the integrations manager) are passed on each call.
 */
export class PluginSmsSender implements ISmsSender {
  readonly configured = true;

  constructor(
    /** The plugin that provides it — the only one ever shown these settings (`context.sms.activeSettings`). */
    readonly owner: string,
    readonly key: string,
    private readonly sendWith: (config: Record<string, unknown>, message: { to: string; body: string }) => Promise<unknown>,
    readonly config: Record<string, unknown>,
  ) {}

  async send(message: { to: string; body: string }): Promise<{ id: string }> {
    const answer = CoercionUtils.toObject(await this.sendWith(this.config, message));
    return { id: CoercionUtils.toString(answer.id) };
  }
}
