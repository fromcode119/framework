import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What happened to one email, in the console's words and colours. */
export class EmailStatusBadge extends PureReactor {
  @prop declare status: string;

  private get tone(): string {
    if (this.status === 'sent') return 'success';
    if (this.status === 'failed' || this.status === 'bounced') return 'danger';
    if (this.status === 'complained') return 'warning';
    return 'default';
  }

  render(): ReactNode {
    return <StateBadge tone={this.tone}>{AdminI18n.optional(`emails.status.${this.status}`) || this.status}</StateBadge>;
  }
}
