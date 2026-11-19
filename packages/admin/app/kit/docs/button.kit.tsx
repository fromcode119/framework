import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { AdminLink } from '@/components/view/admin-link.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class ButtonKit {
  static doc(): KitDoc {
    return {
      slug: 'button', name: 'Button', group: 'Actions',
      intro: 'What someone presses to make something happen. One primary button a screen; everything else is secondary or ghost.',
      from: "import { Button, ButtonVariant, FieldSize } from '@fromcode119/sdk/admin';",
      examples: [
        {
          title: 'Variants',
          text: 'Primary is the one thing the screen is for. Secondary is every other action. Ghost is an action that should not draw the eye. Danger removes or cannot be undone.',
          demo: (
            <>
              <Button variant={ButtonVariant.PRIMARY}>Primary</Button>
              <Button variant={ButtonVariant.SECONDARY}>Secondary</Button>
              <Button variant={ButtonVariant.GHOST}>Ghost</Button>
              <Button variant={ButtonVariant.DANGER}>Danger</Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.PRIMARY}>Primary</Button>\n<Button variant={ButtonVariant.SECONDARY}>Secondary</Button>\n<Button variant={ButtonVariant.GHOST}>Ghost</Button>\n<Button variant={ButtonVariant.DANGER}>Danger</Button>',
        },
        {
          title: 'With an icon',
          text: 'The icon goes in `icon`, not in the children, so it keeps its gap and gives way to the spinner while loading. Icons are 15px.',
          demo: (
            <>
              <Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>New product</Button>
              <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={15} />}>Export</Button>
              <Button variant={ButtonVariant.GHOST} icon={<FrameworkIcons.Edit size={15} />}>Edit</Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />}>New product</Button>',
        },
        {
          title: 'Icon only',
          text: 'A square of the same height. It has no words, so it must carry an `aria-label`.',
          demo: (
            <>
              <Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label="Edit"><FrameworkIcons.Edit size={15} /></Button>
              <Button variant={ButtonVariant.GHOST} size={FieldSize.ICON} aria-label="More"><FrameworkIcons.More size={15} /></Button>
              <Button variant={ButtonVariant.DANGER} size={FieldSize.ICON} aria-label="Delete"><FrameworkIcons.Trash size={15} /></Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label="Edit">\n  <FrameworkIcons.Edit size={15} />\n</Button>',
        },
        {
          title: 'Loading and disabled',
          text: 'A loading button keeps its width, shows a spinner and cannot be pressed again. A disabled one says the action is not available now.',
          demo: (
            <>
              <Button variant={ButtonVariant.PRIMARY} isLoading>Saving</Button>
              <Button variant={ButtonVariant.SECONDARY} isLoading>Saving</Button>
              <Button variant={ButtonVariant.PRIMARY} disabled>Primary</Button>
              <Button variant={ButtonVariant.SECONDARY} disabled>Secondary</Button>
              <Button variant={ButtonVariant.GHOST} disabled>Ghost</Button>
              <Button variant={ButtonVariant.DANGER} disabled>Danger</Button>
            </>
          ),
          code: '<Button variant={ButtonVariant.PRIMARY} isLoading>Saving</Button>\n<Button variant={ButtonVariant.SECONDARY} disabled>Secondary</Button>',
        },
        {
          title: 'As a link',
          text: 'A button that goes somewhere is a link that looks like a button: pass the link component in `as` and the address in `href`.',
          demo: <Button variant={ButtonVariant.SECONDARY} as={AdminLink} href="/kit">Back to the kit</Button>,
          code: '<Button variant={ButtonVariant.SECONDARY} as={AdminLink} href="/kit">Back to the kit</Button>',
        },
        {
          title: 'In a row',
          text: 'Buttons that belong together stand 8px apart, the primary one last.',
          demo: (
            <div className="fc-kitdoc__inline">
              <Button variant={ButtonVariant.SECONDARY}>Cancel</Button>
              <Button variant={ButtonVariant.PRIMARY}>Save</Button>
            </div>
          ),
          code: '<Button variant={ButtonVariant.SECONDARY}>Cancel</Button>\n<Button variant={ButtonVariant.PRIMARY}>Save</Button>',
        },
      ],
      options: [
        { name: 'variant', type: 'ButtonVariant', initial: 'SECONDARY', does: 'PRIMARY, SECONDARY, GHOST or DANGER.' },
        { name: 'size', type: 'FieldSize', initial: 'one height', does: 'Only ICON changes anything: a square for a button that is an icon alone.' },
        { name: 'icon', type: 'ReactNode', does: 'An icon before the words.' },
        { name: 'isLoading', type: 'boolean', initial: 'false', does: 'Shows a spinner and stops further presses.' },
        { name: 'disabled', type: 'boolean', initial: 'false', does: 'The action is not available.' },
        { name: 'as, href, target', type: 'component, string', does: 'Renders a link that looks like the button.' },
        { name: 'type, onClick, aria-label…', type: 'button attributes', does: 'Everything a <button> takes is passed through.' },
      ],
    };
  }
}
