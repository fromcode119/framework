import { KitCopy } from '@/app/kit/kit-copy';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { AdminLink } from '@/components/view/admin-link.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class ButtonKit {
  static doc(): KitDoc {
    return {
      slug: 'button', name: 'Button', group: KitCopy.t('docs.button.actions'),
      intro: KitCopy.t('docs.button.whatSomeonePressesToMake'),
      from: "import { Button, ButtonVariant, FieldSize } from '@fromcode119/sdk/admin';",
      examples: [
        {
          title: KitCopy.t('docs.button.variants'),
          text: KitCopy.t('docs.button.primaryIsTheOneThing'),
          demo: (
            <>
              <Button variant={ButtonVariant.PRIMARY}>{KitCopy.t('docs.button.primary')}</Button>
              <Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.button.secondary')}</Button>
              <Button variant={ButtonVariant.GHOST}>{KitCopy.t('docs.button.ghost')}</Button>
              <Button variant={ButtonVariant.DANGER}>{KitCopy.t('docs.button.danger')}</Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.PRIMARY}>Primary</Button>\n<Button variant={ButtonVariant.SECONDARY}>Secondary</Button>\n<Button variant={ButtonVariant.GHOST}>Ghost</Button>\n<Button variant={ButtonVariant.DANGER}>Danger</Button>',
        },
        {
          title: KitCopy.t('docs.button.withAnIcon'),
          text: KitCopy.t('docs.button.theIconGoesInIcon'),
          demo: (
            <>
              <Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>{KitCopy.t('docs.button.newProduct')}</Button>
              <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={15} />}>{KitCopy.t('docs.button.export')}</Button>
              <Button variant={ButtonVariant.GHOST} icon={<FrameworkIcons.Edit size={15} />}>{KitCopy.t('docs.button.edit')}</Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>New product</Button>',
        },
        {
          title: KitCopy.t('docs.button.iconOnly'),
          text: KitCopy.t('docs.button.aSquareOfTheSame'),
          demo: (
            <>
              <Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label={KitCopy.t('docs.button.edit')}><FrameworkIcons.Edit size={15} /></Button>
              <Button variant={ButtonVariant.GHOST} size={FieldSize.ICON} aria-label={KitCopy.t('docs.button.more')}><FrameworkIcons.More size={15} /></Button>
              <Button variant={ButtonVariant.DANGER} size={FieldSize.ICON} aria-label={KitCopy.t('docs.button.delete')}><FrameworkIcons.Trash size={15} /></Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label="Edit">\n  <FrameworkIcons.Edit size={15} />\n</Button>',
        },
        {
          title: KitCopy.t('docs.button.loadingAndDisabled'),
          text: KitCopy.t('docs.button.aLoadingButtonKeepsIts'),
          demo: (
            <>
              <Button variant={ButtonVariant.PRIMARY} isLoading>{KitCopy.t('docs.button.saving')}</Button>
              <Button variant={ButtonVariant.SECONDARY} isLoading>{KitCopy.t('docs.button.saving')}</Button>
              <Button variant={ButtonVariant.PRIMARY} disabled>{KitCopy.t('docs.button.primary')}</Button>
              <Button variant={ButtonVariant.SECONDARY} disabled>{KitCopy.t('docs.button.secondary')}</Button>
              <Button variant={ButtonVariant.GHOST} disabled>{KitCopy.t('docs.button.ghost')}</Button>
              <Button variant={ButtonVariant.DANGER} disabled>{KitCopy.t('docs.button.danger')}</Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.PRIMARY} isLoading>Saving</Button>\n<Button variant={ButtonVariant.SECONDARY} disabled>Secondary</Button>',
        },
        {
          title: KitCopy.t('docs.button.asALink'),
          text: KitCopy.t('docs.button.aButtonThatGoesSomewhere'),
          demo: <Button variant={ButtonVariant.SECONDARY} as={AdminLink} href="/kit">{KitCopy.t('docs.button.backToTheKit')}</Button>,
          code: '<Button variant={ButtonVariant.SECONDARY} as={AdminLink} href="/kit">Back to the kit</Button>',
        },
        {
          title: KitCopy.t('docs.button.inARow'),
          text: KitCopy.t('docs.button.buttonsThatBelongTogetherStand'),
          demo: (
            <div className="fc-kitdoc__inline">
              <Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.button.cancel')}</Button>
              <Button variant={ButtonVariant.PRIMARY}>{KitCopy.t('docs.button.save')}</Button>
            </div>
          ),
          code: '<Button variant={ButtonVariant.SECONDARY}>Cancel</Button>\n<Button variant={ButtonVariant.PRIMARY}>Save</Button>',
        },
      ],
      options: [
        { name: 'variant', type: 'ButtonVariant', initial: 'SECONDARY', does: KitCopy.t('docs.button.primarySecondaryGhostOrDanger') },
        { name: 'size', type: 'FieldSize', initial: 'one height', does: KitCopy.t('docs.button.onlyIconChangesAnythingA') },
        { name: 'icon', type: 'ReactNode', does: KitCopy.t('docs.button.anIconBeforeTheWords') },
        { name: 'block', type: 'boolean', initial: 'false', does: KitCopy.t('docs.button.asWideAsItsContainer') },
        { name: 'isLoading', type: 'boolean', initial: 'false', does: KitCopy.t('docs.button.showsASpinnerAndStops') },
        { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.button.theActionIsNotAvailable') },
        { name: 'as, href, target', type: 'component, string', does: KitCopy.t('docs.button.rendersALinkThatLooks') },
        { name: 'type, onClick, aria-label…', type: 'button attributes', does: KitCopy.t('docs.button.everythingAButtonTakesIs') },
      ],
    };
  }
}
