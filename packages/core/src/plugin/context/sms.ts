import { ChannelConsentStore } from '@core/notifications/channel-consent-store';
import { ConsentChannel } from '@core/notifications/enums/consent-channel.enum';
import { PersonNotifier } from '@core/notifications/person-notifier';
import { PhoneNumber } from '@core/notifications/phone-number';
import { PluginSmsSender } from '@core/notifications/plugin-sms-sender';
import { SmsIntegrationDefinition } from '@core/integrations/providers/sms-integration-definition';
import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginContextSms } from '@core/plugin/interfaces/plugin-context-sms.interface';

/**
 * `context.sms` — see {@link IPluginContextSms}.
 *
 * The provider hands over a `send` FUNCTION rather than an object with methods: a plugin runs in its
 * own process, and a function is what survives the trip (it is called back there). The framework wraps
 * it as the integration's instance, so the rest of the platform sees an ordinary sender.
 */
export class SmsContextProxy {
  /**
   * Plugins that registered a text-message provider. Withdrawing a number's consent is what a carrier
   * tells its provider ("this number replied STOP"); any other plugin doing it could silence anyone.
   */
  private static readonly senders = new Set<string>();

  static createSmsProxy(plugin: ILoadedPlugin, manager: IPluginManagerInterface): IPluginContextSms {
    return {
      registerProvider: (provider) => {
        const key = String(provider?.key ?? '').trim();
        if (!key || key === SmsIntegrationDefinition.UNCONFIGURED) throw new Error('A text-message provider needs its own key');
        const send = provider.send;
        SmsContextProxy.senders.add(plugin.manifest.slug);
        manager.integrations.registerProvider(SmsIntegrationDefinition.KEY, {
          key,
          label: String(provider.label ?? key),
          description: provider.description ? String(provider.description) : undefined,
          // Types arrive as plain strings from a plugin's process; a password field must be the enum to be
          // masked in the console and decrypted for `send`.
          fields: (Array.isArray(provider.fields) ? provider.fields : []).map((field: any) => ({ ...field, type: IntegrationConfigFieldType.resolve(field?.type) })), // eslint-disable-line @typescript-eslint/no-explicit-any
          namespace: plugin.manifest.namespace,
          create: (config: Record<string, unknown>) => new PluginSmsSender(plugin.manifest.slug, key, (settings, message) => send(settings, message), config ?? {}),
        }, plugin.manifest.slug);
      },

      optOut: async (phone: string) => {
        if (!SmsContextProxy.senders.has(plugin.manifest.slug)) {
          throw new Error(`context.sms.optOut refused: plugin "${plugin.manifest.slug}" sends no text messages.`);
        }
        const number = PhoneNumber.normalize(phone);
        if (!number) return { withdrawn: 0 };
        return { withdrawn: await new ChannelConsentStore(manager.db).revokeAddress(ConsentChannel.SMS, number) };
      },

      status: async () => ({ configured: (await new PersonNotifier(manager).sender()).configured }),

      activeSettings: async () => {
        const sender = await new PersonNotifier(manager).sender();
        return sender instanceof PluginSmsSender && sender.owner === plugin.manifest.slug ? { provider: sender.key, config: { ...sender.config } } : null;
      },
    };
  }
}
