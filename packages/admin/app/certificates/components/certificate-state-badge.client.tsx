import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { CertificateHost } from '@/lib/certificates/certificate-host';

/**
 * A host's certificate state, at a glance.
 *
 * The tone comes from the state itself rather than being decided here, so the admin and anything
 * else that shows a state agree about which ones are an emergency.
 */
export class CertificateStateBadge extends PureReactor {
  declare props: Pick<CertificateStateBadge, 'entry'>;

  @prop declare entry: CertificateHost;

  private get variant(): BadgeVariant {
    const byTone: Record<string, BadgeVariant> = {
      good: BadgeVariant.SUCCESS,
      warn: BadgeVariant.AMBER,
      danger: BadgeVariant.DANGER,
      neutral: BadgeVariant.GRAY,
    };
    return byTone[this.entry.tone] ?? BadgeVariant.GRAY;
  }

  render(): ReactNode {
    return <Badge variant={this.variant}>{this.entry.stateLabel}</Badge>;
  }
}
