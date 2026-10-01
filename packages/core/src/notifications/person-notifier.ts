import { Logger } from '@core/logging';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { PushDelivery } from '@core/push/push-delivery';
import { PushSurface } from '@core/push/enums/push-surface.enum';
import { ChannelConsentStore } from '@core/notifications/channel-consent-store';
import { ConsentChannel } from '@core/notifications/enums/consent-channel.enum';
import { NotificationCategory } from '@core/notifications/enums/notification-category.enum';
import { UnconfiguredSmsSender } from '@core/notifications/unconfigured-sms-sender';
import { SmsIntegrationDefinition } from '@core/integrations/providers/sms-integration-definition';
import type { ISmsSender } from '@core/notifications/interfaces/sms-sender.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * Tells a customer something outside the site, the ways THEY chose (`context.notifications.notifyPerson`).
 *
 * - Push: to their storefront devices. An update goes to every device they turned notifications on
 *   for; an offer only when they also agreed to offers.
 * - Text: only with a recorded consent for that category, to the number they agreed with, and only
 *   when the site has a text-message provider set up.
 *
 * Email stays with the sender, which already writes its own. Nothing here fails the caller: each way
 * that does not work is logged and counted, never thrown into the order or booking that caused it.
 */
export class PersonNotifier {
  private static readonly logger = new Logger({ namespace: 'notifications' });
  /** One or two text messages' worth. A text is a nudge; the details are on the site. */
  static readonly MAX_TEXT_LENGTH = 320;

  private readonly consents: ChannelConsentStore;

  constructor(private readonly manager: IPluginManagerInterface) {
    this.consents = new ChannelConsentStore(manager.db);
  }

  async notify(input: {
    userId: number;
    title: string;
    body?: string;
    link?: string;
    /** The text message, when it should read differently from the notification. */
    text?: string;
    category: NotificationCategory;
  }): Promise<{ pushed: number; texted: boolean }> {
    const userId = Number(input.userId);
    if (!Number.isFinite(userId) || userId <= 0 || !String(input.title ?? '').trim()) return { pushed: 0, texted: false };
    const [pushed, texted] = await Promise.all([this.push(userId, input), this.text(userId, input)]);
    return { pushed, texted };
  }

  private async push(userId: number, input: { title: string; body?: string; link?: string; category: NotificationCategory }): Promise<number> {
    try {
      if (input.category === NotificationCategory.OFFERS && !(await this.consents.find(userId, ConsentChannel.PUSH, NotificationCategory.OFFERS))) return 0;
      return await new PushDelivery(this.manager.db, MetaContextProxy.createMetaProxy(this.manager)).toPerson(userId, input, PushSurface.STOREFRONT);
    } catch (error) {
      PersonNotifier.logger.warn(`A notification could not be pushed: ${String((error as Error)?.message ?? error)}`);
      return 0;
    }
  }

  private async text(userId: number, input: { title: string; body?: string; text?: string; category: NotificationCategory }): Promise<boolean> {
    try {
      const consent = await this.consents.find(userId, ConsentChannel.SMS, input.category);
      const to = String(consent?.address ?? '');
      if (!to) return false;
      const sender = await this.sender();
      if (!sender.configured) return false;
      const body = String(input.text || [input.title, input.body].filter(Boolean).join('\n')).slice(0, PersonNotifier.MAX_TEXT_LENGTH);
      await sender.send({ to, body });
      return true;
    } catch (error) {
      PersonNotifier.logger.warn(`A text message could not be sent: ${String((error as Error)?.message ?? error)}`);
      return false;
    }
  }

  /** The site's text-message provider, or the honest "Not set up". */
  async sender(): Promise<ISmsSender> {
    try {
      return (await this.manager.integrations.get(SmsIntegrationDefinition.KEY)) ?? new UnconfiguredSmsSender();
    } catch {
      return new UnconfiguredSmsSender();
    }
  }
}
