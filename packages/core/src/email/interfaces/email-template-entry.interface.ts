import type { IEmailTemplateDescriptor } from '@core/email/interfaces/email-template-descriptor.interface';
import type { IRenderedEmail } from '@core/email/interfaces/rendered-email.interface';

/** A declared email as the registry holds it: who declared it, and how to draw it. */
export interface IEmailTemplateEntry extends IEmailTemplateDescriptor {
  /** `<sender>:<key>` — what the email log records and the catalog links by. */
  id: string;
  /** The declaring extension's slug; empty for the platform's own emails. */
  sender: string;
  render: (data: Record<string, unknown>) => Promise<IRenderedEmail>;
}
