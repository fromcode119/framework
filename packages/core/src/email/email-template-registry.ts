import type { IEmailTemplateDescriptor } from '@core/email/interfaces/email-template-descriptor.interface';
import type { IEmailTemplateEntry } from '@core/email/interfaces/email-template-entry.interface';
import type { IRenderedEmail } from '@core/email/interfaces/rendered-email.interface';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * Every kind of email the platform and its extensions can send — the email catalog.
 *
 * Mail was sent from code paths nobody could list: an operator learnt that an email existed when a
 * customer received it. Each sender now declares its emails with when they go out and example data,
 * and the catalog shows them, draws each one, and counts how often it was sent.
 *
 * Process-wide, like the personal-data registry: one api serves every site, so a listing narrows to
 * the extensions the requesting site runs. Rebuilt on every boot from what is actually installed.
 */
export class EmailTemplateRegistry {
  /** The sender value of the platform's own emails in an id: `platform:password-reset`. */
  static readonly PLATFORM = 'platform';
  private static readonly entries = new Map<string, IEmailTemplateEntry>();

  static idOf(sender: string, key: string): string {
    return `${String(sender || '').trim() || EmailTemplateRegistry.PLATFORM}:${String(key || '').trim()}`;
  }

  /** Declare one email. Refused when it has no key, no name or no trigger: a catalog entry must say all three. */
  static register(sender: string, descriptor: IEmailTemplateDescriptor, render: (data: Record<string, unknown>) => Promise<IRenderedEmail>): boolean {
    const key = String(descriptor?.key || '').trim();
    // `platform` names the platform's own emails; an extension with that slug must not pose as them.
    if (String(sender || '').trim() === EmailTemplateRegistry.PLATFORM) return false;
    if (!key || !String(descriptor?.labelKey || '').trim() || !String(descriptor?.triggerKey || '').trim()) return false;
    const id = EmailTemplateRegistry.idOf(sender, key);
    EmailTemplateRegistry.entries.set(id, {
      ...descriptor,
      key,
      id,
      sender: String(sender || '').trim(),
      sample: descriptor.sample && typeof descriptor.sample === 'object' ? descriptor.sample : {},
      render,
    });
    return true;
  }

  static unregisterBySender(sender: string): void {
    for (const [id, entry] of EmailTemplateRegistry.entries) {
      if (entry.sender === sender) EmailTemplateRegistry.entries.delete(id);
    }
  }

  /** The emails of this request's site: the platform's own and those of the extensions it runs. */
  static listForCurrentTenant(): IEmailTemplateEntry[] {
    const all = Array.from(EmailTemplateRegistry.entries.values());
    if (!RequestContextUtils.getTenantId()) return all;
    return all.filter((entry) => !entry.sender || PluginTenantAccess.isEnabledForCurrentTenant(entry.sender));
  }

  static get(id: string): IEmailTemplateEntry | undefined {
    const entry = EmailTemplateRegistry.entries.get(String(id || '').trim());
    if (!entry) return undefined;
    return EmailTemplateRegistry.listForCurrentTenant().includes(entry) ? entry : undefined;
  }

  static clear(): void {
    EmailTemplateRegistry.entries.clear();
  }
}
