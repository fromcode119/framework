import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class BadgeKit {
  static doc(): KitDoc {
    return {
      slug: 'badge', name: 'Badge and StateBadge', group: 'Feedback',
      intro: 'A short state beside a name. StateBadge — a dot and a word — is a record’s state in a list or a header. Badge — a tinted label — marks something about a thing: a role, a warning, a count.',
      from: "import { Badge, BadgeVariant, StateBadge } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'StateBadge tones', text: 'The tone is the one the status option declares. Anything else is neutral.', demo: <><StateBadge tone="success">Published</StateBadge><StateBadge tone="warning">Draft</StateBadge><StateBadge tone="danger">Rejected</StateBadge><StateBadge tone="info">Running</StateBadge><StateBadge tone="default">Proposed</StateBadge></>, code: '<StateBadge tone="success">Published</StateBadge>\n<StateBadge tone="warning">Draft</StateBadge>\n<StateBadge tone="danger">Rejected</StateBadge>\n<StateBadge tone="info">Running</StateBadge>\n<StateBadge>Proposed</StateBadge>' },
        { title: 'Badge tones', demo: <><Badge variant={BadgeVariant.SUCCESS}>Administrator</Badge><Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge><Badge variant={BadgeVariant.DANGER}>Error</Badge><Badge variant={BadgeVariant.INFO}>Beta</Badge><Badge variant={BadgeVariant.DEFAULT}>No account</Badge></>, code: '<Badge variant={BadgeVariant.SUCCESS}>Administrator</Badge>\n<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>\n<Badge variant={BadgeVariant.DANGER}>Error</Badge>\n<Badge variant={BadgeVariant.INFO}>Beta</Badge>\n<Badge>No account</Badge>' },
        { title: 'Beside a name', text: 'A badge follows the name it speaks of, 6–8px after it, centred on its line.', demo: <span className="fc-kitdoc__inline"><strong>Finance Core</strong><Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge></span>, code: '<span>Finance Core</span>\n<Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>' },
      ],
      options: [
        { name: 'StateBadge tone', type: "success · warning · danger · info", initial: 'neutral', does: 'The colour of the dot.' },
        { name: 'Badge variant', type: 'BadgeVariant', initial: 'DEFAULT', does: 'SUCCESS, WARNING, DANGER, INFO or DEFAULT.' },
        { name: 'children', type: 'ReactNode', does: 'The word — one or two, in sentence case.' },
      ],
    };
  }
}
