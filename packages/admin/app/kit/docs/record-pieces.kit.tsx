import { KitCopy } from '@/app/kit/kit-copy';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ValueRow } from '@/components/ui/view/value-row.client';
import { Crumbs } from '@/components/ui/view/crumbs.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { KitDoc } from '@/app/kit/kit-doc';

/** The pieces a record page is drawn from, for a plugin screen that is laid out like one. */
export class RecordPiecesKit {
  static docs(): KitDoc[] {
    return [
      {
        slug: 'value-row', name: 'ValueRow', group: KitCopy.t('docs.record-pieces.layout'),
        intro: KitCopy.t('docs.record-pieces.valueRowIntro'),
        from: "import { ValueRow } from '@fromcode119/sdk/admin';",
        examples: [
          {
            title: KitCopy.t('docs.record-pieces.rowsInACard'),
            demo: (
              <div className="fc-kitdoc__cell--wide">
                <RecordCard title={KitCopy.t('docs.record-pieces.package')}>
                  <div className="fc-record-card__rows">
                    <ValueRow label={KitCopy.t('docs.record-pieces.width')}>{KitCopy.t('docs.record-pieces.widthValue')}</ValueRow>
                    <ValueRow label={KitCopy.t('docs.record-pieces.height')} empty>–</ValueRow>
                    <ValueRow label={KitCopy.t('docs.record-pieces.size')} action={<Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} type="button" aria-label={KitCopy.t('docs.record-pieces.open')}><FrameworkIcons.Right size={14} /></Button>}>S · M · L</ValueRow>
                  </div>
                </RecordCard>
              </div>
            ),
            code: '<ValueRow label="Width">20 cm</ValueRow>\n<ValueRow label="Height" empty>–</ValueRow>\n<ValueRow label="Size" action={<Button …/>}>S · M · L</ValueRow>',
          },
        ],
        options: [
          { name: 'label', type: 'ReactNode', does: KitCopy.t('docs.record-pieces.theNameOfTheValue') },
          { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.record-pieces.theValue') },
          { name: 'action', type: 'ReactNode', does: KitCopy.t('docs.record-pieces.aControlAtTheEnd') },
          { name: 'empty', type: 'boolean', initial: 'false', does: KitCopy.t('docs.record-pieces.mutedForAnAbsentValue') },
        ],
      },
      {
        slug: 'crumbs', name: 'Crumbs', group: KitCopy.t('docs.record-pieces.layout'),
        intro: KitCopy.t('docs.record-pieces.crumbsIntro'),
        from: "import { Crumbs } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.record-pieces.overAPage'), demo: <Crumbs href="#" listLabel={KitCopy.t('docs.record-pieces.orders')} title={KitCopy.t('docs.record-pieces.newOrder')} />, code: '<Crumbs href={ordersHref} listLabel="Orders" title="New order" />' },
        ],
        options: [
          { name: 'href', type: 'string', does: KitCopy.t('docs.record-pieces.theListThePageBelongsTo') },
          { name: 'listLabel', type: 'string', does: KitCopy.t('docs.record-pieces.theListName') },
          { name: 'title', type: 'ReactNode', does: KitCopy.t('docs.record-pieces.thisPage') },
        ],
      },
    ];
  }
}
