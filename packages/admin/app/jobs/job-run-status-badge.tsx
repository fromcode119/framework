import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** How a run ended — or that it is still going — in the console's words and colours. */
export class JobRunStatusBadge extends PureReactor {
  @prop declare status: string;

  private get variant(): BadgeVariant {
    if (this.status === 'succeeded') return BadgeVariant.SUCCESS;
    if (this.status === 'failed') return BadgeVariant.DANGER;
    return BadgeVariant.INFO;
  }

  render(): ReactNode {
    return <Badge variant={this.variant}>{AdminI18n.optional(`jobs.status.${this.status}`) || this.status}</Badge>;
  }
}
