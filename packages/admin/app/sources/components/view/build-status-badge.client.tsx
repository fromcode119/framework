import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A source's last build, as the admin's own Badge.
 *
 * Success is the quiet grey one. Nearly every row is a success, and forty green badges made the one
 * failure or pending build the hardest thing on the screen to find; colour is kept for what needs a look.
 */
export class BuildStatusBadge extends PureReactor {
  declare props: Pick<BuildStatusBadge, 'status'>;

  @prop declare status: string;

  private get variant(): BadgeVariant {
    if (this.status === 'success') return BadgeVariant.GRAY;
    if (this.status === 'failed') return BadgeVariant.DANGER;
    if (this.status === 'building') return BadgeVariant.AMBER;
    return BadgeVariant.WARNING;
  }

  private get label(): string {
    if (this.status === 'success') return AdminI18n.t('sources.success');
    if (this.status === 'failed') return AdminI18n.t('sources.failed');
    if (this.status === 'building') return AdminI18n.t('sources.building');
    return AdminI18n.t('sources.pending');
  }

  render(): ReactNode {
    return (
      <Badge variant={this.variant}>
        {this.status === 'building' ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : null}
        {this.label}
      </Badge>
    );
  }
}
