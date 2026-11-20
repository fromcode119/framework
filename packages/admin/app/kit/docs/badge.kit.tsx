import { KitCopy } from '@/app/kit/kit-copy';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class BadgeKit {
  static doc(): KitDoc {
    return {
      slug: 'badge', name: 'Badge and StateBadge', group: KitCopy.t('docs.badge.feedback'),
      intro: KitCopy.t('docs.badge.aShortStateBesideA'),
      from: "import { Badge, BadgeVariant, StateBadge } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.badge.statebadgeTones'), text: KitCopy.t('docs.badge.theToneIsTheOne'), demo: <><StateBadge tone="success">{KitCopy.t('docs.badge.published')}</StateBadge><StateBadge tone="warning">{KitCopy.t('docs.badge.draft')}</StateBadge><StateBadge tone="danger">{KitCopy.t('docs.badge.rejected')}</StateBadge><StateBadge tone="info">{KitCopy.t('docs.badge.running')}</StateBadge><StateBadge tone="default">{KitCopy.t('docs.badge.proposed')}</StateBadge></>, code: '<StateBadge tone="success">Published</StateBadge>\n<StateBadge tone="warning">Draft</StateBadge>\n<StateBadge tone="danger">Rejected</StateBadge>\n<StateBadge tone="info">Running</StateBadge>\n<StateBadge>Proposed</StateBadge>' },
        { title: KitCopy.t('docs.badge.badgeTones'), demo: <><Badge variant={BadgeVariant.SUCCESS}>{KitCopy.t('docs.badge.administrator')}</Badge><Badge variant={BadgeVariant.WARNING}>{KitCopy.t('docs.badge.waitingForApproval')}</Badge><Badge variant={BadgeVariant.DANGER}>{KitCopy.t('docs.badge.error')}</Badge><Badge variant={BadgeVariant.INFO}>{KitCopy.t('docs.badge.beta')}</Badge><Badge variant={BadgeVariant.DEFAULT}>{KitCopy.t('docs.badge.noAccount')}</Badge></>, code: '<Badge variant={BadgeVariant.SUCCESS}>Administrator</Badge>\n<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>\n<Badge variant={BadgeVariant.DANGER}>Error</Badge>\n<Badge variant={BadgeVariant.INFO}>Beta</Badge>\n<Badge>No account</Badge>' },
        { title: KitCopy.t('docs.badge.besideAName'), text: KitCopy.t('docs.badge.aBadgeFollowsTheName'), demo: <span className="fc-kitdoc__inline"><strong>{KitCopy.t('docs.badge.financeCore')}</strong><Badge variant={BadgeVariant.WARNING}>{KitCopy.t('docs.badge.waitingForApproval')}</Badge></span>, code: '<span>Finance Core</span>\n<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>' },
      ],
      options: [
        { name: 'StateBadge tone', type: "success · warning · danger · info", initial: 'neutral', does: KitCopy.t('docs.badge.theColourOfTheDot') },
        { name: 'Badge variant', type: 'BadgeVariant', initial: 'DEFAULT', does: KitCopy.t('docs.badge.successWarningDangerInfoOr') },
        { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.badge.theWordOneOrTwo') },
      ],
    };
  }
}
