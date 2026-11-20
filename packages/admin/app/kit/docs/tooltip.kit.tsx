import { FrameworkIcons } from '@fromcode119/react';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

export class TooltipKit {
  static doc(): KitDoc {
    return {
      slug: 'tooltip', name: 'Tooltip', group: 'Feedback',
      intro: 'A few words that appear over a thing on hover, on focus, and on a tap on a phone. For what an icon means or what a cut text says in full — never for something the reader must see.',
      from: "import { Tooltip } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'On a control', demo: <Tooltip content="Edit the product"><Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label="Edit"><FrameworkIcons.Edit size={15} /></Button></Tooltip>, code: '<Tooltip content="Edit the product">\n  <Button size={FieldSize.ICON} aria-label="Edit"><FrameworkIcons.Edit size={15} /></Button>\n</Tooltip>' },
        { title: 'On a badge or a word', demo: <><Tooltip content="What changed since it was approved: +database +api"><Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge></Tooltip><Tooltip content="Stock keeping unit: the shop’s own code for the product."><span className="fc-kitdoc__dotted">SKU</span></Tooltip></>, code: '<Tooltip content="What changed since it was approved: +database +api">\n  <Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>\n</Tooltip>' },
        { title: 'Side', text: 'Above by default; under when there is no room above, or when asked.', demo: <><Tooltip content="Above"><Button variant={ButtonVariant.SECONDARY}>Top</Button></Tooltip><Tooltip content="Under" side="bottom"><Button variant={ButtonVariant.SECONDARY}>Bottom</Button></Tooltip></>, code: '<Tooltip content="Under" side="bottom">…</Tooltip>' },
      ],
      options: [
        { name: 'content', type: 'ReactNode', does: 'What it says. Keep it to a line or two.' },
        { name: 'children', type: 'ReactNode', does: 'The thing it speaks of.' },
        { name: 'side', type: "top · bottom", initial: 'top', does: 'Where it appears.' },
      ],
    };
  }
}
