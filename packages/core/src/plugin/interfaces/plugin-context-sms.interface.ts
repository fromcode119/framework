/**
 * The `context.sms` surface of {@link PluginContext}: for a plugin that PROVIDES text messages.
 *
 * Plugins that want to text a customer do not use this — they call `context.notifications.notifyPerson`,
 * which checks the person's consent first. This surface is for the provider (a Twilio or Vonage plugin):
 * it registers itself so a site can choose it under Settings → Integrations → Text messages, and it
 * reports the people who replied STOP.
 */
export interface IPluginContextSms {
  /**
   * Offer this plugin as a text-message provider. `fields` are the settings a site fills in (account
   * id, secret, sender) in the integration settings' field format; `send` receives those settings —
   * secrets decrypted — and one message, and resolves with the provider's message id.
   */
  registerProvider(provider: {
    key: string;
    label: string;
    description?: string;
    fields?: unknown[];
    send(config: Record<string, unknown>, message: { to: string; body: string }): Promise<{ id: string }>;
  }): void;

  /** Someone at `phone` replied STOP: every agreement to text that number on this site is withdrawn. */
  optOut(phone: string): Promise<{ withdrawn: number }>;

  /** Whether this site has a text-message provider set up. */
  status(): Promise<{ configured: boolean }>;
}
