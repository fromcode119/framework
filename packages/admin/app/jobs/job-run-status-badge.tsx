import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** How a run ended — or that it is still going — in the console's words and colours. */
export class JobRunStatusBadge extends PureReactor {
  @prop declare status: string;

  private get tone(): string {
    if (this.status === 'succeeded') return 'success';
    if (this.status === 'failed') return 'danger';
    return 'info';
  }

  render(): ReactNode {
    return <StateBadge tone={this.tone}>{AdminI18n.optional(`jobs.status.${this.status}`) || this.status}</StateBadge>;
  }
}
