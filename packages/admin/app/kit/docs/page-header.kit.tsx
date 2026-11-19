import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

export class PageHeaderKit {
  static doc(): KitDoc {
    return {
      slug: 'page-header', name: 'CompactPageHeader', group: 'Layout',
      intro: 'The head of a page that is not one list: a settings page, a record that is not a collection’s. A page that IS one list has no page header — its name is the head of its ListShell.',
      from: "import { CompactPageHeader } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'Title only', flush: true, demo: <CompactPageHeader title="General" />, code: '<CompactPageHeader title="General" />' },
        { title: 'With a line under it and an action', flush: true, demo: <CompactPageHeader title="Integrations" subtitle="The services this site talks to." actions={<Button variant={ButtonVariant.PRIMARY}>Add</Button>} />, code: '<CompactPageHeader title="Integrations" subtitle="The services this site talks to."\n  actions={<Button variant={ButtonVariant.PRIMARY}>Add</Button>} />' },
        { title: 'With the way back and a mark', flush: true, text: 'A page one step inside another carries the way back; a thing with an icon of its own shows it as its mark.', demo: <CompactPageHeader backHref="/kit" mark={<FrameworkIcons.Plugins size={18} />} title="Finance Core" subtitle="Active · v0.1.172 · Fromcode Core" actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.More size={15} />} aria-label="More" />} />, code: '<CompactPageHeader backHref="/plugins/installed" mark={<Icon />} title="Finance Core"\n  subtitle="Active · v0.1.172 · Fromcode Core" actions={…} />' },
      ],
      options: [
        { name: 'title', type: 'ReactNode', does: 'The page’s name.' },
        { name: 'subtitle', type: 'ReactNode', does: 'One line under it.' },
        { name: 'actions', type: 'ReactNode', does: 'Buttons at the end, the primary one last.' },
        { name: 'backHref / onBack', type: 'string / () => void', does: 'The way back, as an arrow before the name.' },
        { name: 'mark', type: 'ReactNode', does: 'The thing’s own icon, in a square before the name.' },
      ],
    };
  }
}
