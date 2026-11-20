import { KitCopy } from '@/app/kit/kit-copy';
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
      slug: 'tooltip', name: 'Tooltip', group: KitCopy.t('docs.tooltip.feedback'),
      intro: KitCopy.t('docs.tooltip.aFewWordsThatAppear'),
      from: "import { Tooltip } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.tooltip.onAControl'), demo: <Tooltip content={KitCopy.t('docs.tooltip.editTheProduct')}><Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label={KitCopy.t('docs.tooltip.edit')}><FrameworkIcons.Edit size={15} /></Button></Tooltip>, code: '<Tooltip content="Edit the product">\n  <Button size={FieldSize.ICON} aria-label="Edit"><FrameworkIcons.Edit size={15} /></Button>\n</Tooltip>' },
        { title: KitCopy.t('docs.tooltip.onABadgeOrA'), demo: <><Tooltip content={KitCopy.t('docs.tooltip.whatChangedSinceItWas')}><Badge variant={BadgeVariant.WARNING}>{KitCopy.t('docs.tooltip.waitingForApproval')}</Badge></Tooltip><Tooltip content={KitCopy.t('docs.tooltip.stockKeepingUnitTheShop')}><span className="fc-kitdoc__dotted">SKU</span></Tooltip></>, code: '<Tooltip content="What changed since it was approved: +database +api">\n  <Badge variant={BadgeVariant.WARNING}>Waiting for approval</Badge>\n</Tooltip>' },
        { title: KitCopy.t('docs.tooltip.side'), text: KitCopy.t('docs.tooltip.aboveByDefaultUnderWhen'), demo: <><Tooltip content={KitCopy.t('docs.tooltip.above')}><Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.tooltip.top')}</Button></Tooltip><Tooltip content={KitCopy.t('docs.tooltip.under')} side="bottom"><Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.tooltip.bottom')}</Button></Tooltip></>, code: '<Tooltip content="Under" side="bottom">…</Tooltip>' },
      ],
      options: [
        { name: 'content', type: 'ReactNode', does: KitCopy.t('docs.tooltip.whatItSaysKeepIt') },
        { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.tooltip.theThingItSpeaksOf') },
        { name: 'side', type: "top · bottom", initial: 'top', does: KitCopy.t('docs.tooltip.whereItAppears') },
      ],
    };
  }
}
