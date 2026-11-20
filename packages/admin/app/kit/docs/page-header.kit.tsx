import { KitCopy } from '@/app/kit/kit-copy';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

export class PageHeaderKit {
  static doc(): KitDoc {
    return {
      slug: 'page-header', name: 'CompactPageHeader', group: KitCopy.t('docs.page-header.layout'),
      intro: KitCopy.t('docs.page-header.theHeadOfAPage'),
      from: "import { CompactPageHeader } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.page-header.titleOnly'), flush: true, demo: <CompactPageHeader title={KitCopy.t('docs.page-header.general')} />, code: '<CompactPageHeader title="General" />' },
        { title: KitCopy.t('docs.page-header.withALineUnderIt'), flush: true, demo: <CompactPageHeader title={KitCopy.t('docs.page-header.integrations')} subtitle="The services this site talks to." actions={<Button variant={ButtonVariant.PRIMARY}>{KitCopy.t('docs.page-header.add')}</Button>} />, code: '<CompactPageHeader title="Integrations" subtitle="The services this site talks to."\n  actions={<Button variant={ButtonVariant.PRIMARY}>Add</Button>} />' },
        { title: KitCopy.t('docs.page-header.withTheWayBackAnd'), flush: true, text: KitCopy.t('docs.page-header.aPageOneStepInside'), demo: <CompactPageHeader backHref="/kit" mark={<FrameworkIcons.Plugins size={18} />} title={KitCopy.t('docs.page-header.financeCore')} subtitle="Active · v0.1.172 · Fromcode Core" actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.More size={15} />} aria-label={KitCopy.t('docs.page-header.more')} />} />, code: '<CompactPageHeader backHref="/plugins/installed" mark={<Icon />} title="Finance Core"\n  subtitle="Active · v0.1.172 · Fromcode Core" actions={…} />' },
      ],
      options: [
        { name: 'title', type: 'ReactNode', does: KitCopy.t('docs.page-header.thePageSName') },
        { name: 'subtitle', type: 'ReactNode', does: KitCopy.t('docs.page-header.oneLineUnderIt') },
        { name: 'actions', type: 'ReactNode', does: KitCopy.t('docs.page-header.buttonsAtTheEndThe') },
        { name: 'backHref / onBack', type: 'string / () => void', does: KitCopy.t('docs.page-header.theWayBackAsAn') },
        { name: 'mark', type: 'ReactNode', does: KitCopy.t('docs.page-header.theThingSOwnIcon') },
      ],
    };
  }
}
