import { KitCopy } from '@/app/kit/kit-copy';
import { FrameworkIcons } from '@fromcode119/react';
import { Tabs } from '@/components/ui/view/tabs.client';
import { ProgressTabs } from '@/components/ui/view/progress-tabs.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class TabsKit {
  private static tabs(props: Record<string, any>, initial: string): any {
    return <div className="fc-kitdoc__cell--wide"><KitPlay initial={initial}>{(value, set) => <Tabs {...(props as any)} value={value} onChange={set} />}</KitPlay></div>;
  }

  static docs(): KitDoc[] {
    const plain = [{ id: 'overview', label: KitCopy.t('docs.tabs.overview') }, { id: 'settings', label: KitCopy.t('docs.tabs.configuration') }, { id: 'security', label: KitCopy.t('docs.tabs.security') }];
    return [
      {
        slug: 'tabs', name: 'Tabs', group: KitCopy.t('docs.tabs.navigation'),
        intro: KitCopy.t('docs.tabs.partsOfOnePageOne'),
        from: "import { Tabs } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.tabs.plain'), text: KitCopy.t('docs.tabs.asAFilterOverA'), demo: TabsKit.tabs({ label: KitCopy.t('docs.tabs.part'), tabs: plain }, 'overview'), code: "<Tabs label=\"Part\" value={tab} onChange={setTab}\n  tabs={[{ id: 'overview', label: 'Overview' }, { id: 'settings', label: 'Configuration' }]} />" },
          { title: KitCopy.t('docs.tabs.withCounts'), demo: TabsKit.tabs({ label: KitCopy.t('docs.tabs.filter'), tabs: [{ id: 'all', label: KitCopy.t('docs.tabs.all'), count: 12 }, { id: 'active', label: KitCopy.t('docs.tabs.active'), count: 9 }, { id: 'off', label: KitCopy.t('docs.tabs.off'), count: 3 }] }, 'all'), code: "tabs={[{ id: 'all', label: 'All', count: 12 }, …]}" },
          { title: KitCopy.t('docs.tabs.withIconsAndADisabled'), demo: TabsKit.tabs({ label: KitCopy.t('docs.tabs.part'), tabs: [{ id: 'a', label: KitCopy.t('docs.tabs.general'), icon: <FrameworkIcons.Settings size={14} /> }, { id: 'b', label: KitCopy.t('docs.tabs.media'), icon: <FrameworkIcons.Image size={14} /> }, { id: 'c', label: KitCopy.t('docs.tabs.history'), disabled: true }] }, 'a'), code: "tabs={[{ id: 'a', label: 'General', icon: <FrameworkIcons.Settings size={14} /> }, { id: 'c', label: 'History', disabled: true }]}" },
          { title: KitCopy.t('docs.tabs.headingAPage'), flush: true, text: KitCopy.t('docs.tabs.variantBarIsTheRow'), demo: TabsKit.tabs({ label: KitCopy.t('docs.tabs.page'), variant: 'bar', tabs: [...plain.slice(0, 2), { id: 'security', label: KitCopy.t('docs.tabs.security'), end: true }, { id: 'limits', label: KitCopy.t('docs.tabs.resourceLimits'), end: true }] }, 'settings'), code: "<Tabs variant=\"bar\" value={tab} onChange={setTab}\n  tabs={[…, { id: 'security', label: 'Security', end: true }]} />" },
          { title: KitCopy.t('docs.tabs.twoLevels'), flush: true, text: KitCopy.t('docs.tabs.theSecondLevelIsVariant'), demo: <div className="fc-tabstack">{TabsKit.tabs({ label: KitCopy.t('docs.tabs.page'), variant: 'bar', tabs: plain }, 'settings')}{TabsKit.tabs({ label: KitCopy.t('docs.tabs.section'), variant: 'second', tabs: ['General', 'Taxes', 'Wallets', 'Exchange rates', 'Invoices'].map((label) => ({ id: label, label })) }, 'General')}</div>, code: '<Tabs variant="bar" … />\n<Tabs variant="second" … />' },
        ],
        options: [
          { name: 'tabs', type: '{ id, label, count?, icon?, disabled?, end? }[]', does: KitCopy.t('docs.tabs.theTabsEndSendsA') },
          { name: 'value, onChange', type: 'string, (id) => void', does: KitCopy.t('docs.tabs.theOpenTabAndWhat') },
          { name: 'variant', type: "bar · second", initial: 'plain', does: KitCopy.t('docs.tabs.thePageSOwnRow') },
          { name: 'label', type: 'string', does: KitCopy.t('docs.tabs.theAccessibleNameOfThe') },
        ],
      },
      {
        slug: 'progress-tabs', name: 'ProgressTabs', group: KitCopy.t('docs.tabs.navigation'),
        intro: KitCopy.t('docs.tabs.theStepsOfSomethingFilled'),
        from: "import { ProgressTabs } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.tabs.steps'), flush: true, demo: <KitPlay initial="organize">{(value, set) => <ProgressTabs label={KitCopy.t('docs.tabs.steps')} value={value} onChange={set} steps={[{ id: 'details', label: KitCopy.t('docs.tabs.details'), status: 'completed' }, { id: 'organize', label: KitCopy.t('docs.tabs.organize'), status: 'in-progress' }, { id: 'variants', label: KitCopy.t('docs.tabs.variants'), status: 'not-started' }, { id: 'inventory', label: KitCopy.t('docs.tabs.inventory'), status: 'not-started', disabled: true }]} />}</KitPlay>, code: "<ProgressTabs value={step} onChange={setStep} steps={[\n  { id: 'details', label: 'Details', status: 'completed' },\n  { id: 'organize', label: 'Organize', status: 'in-progress' },\n  { id: 'variants', label: 'Variants', status: 'not-started' },\n]} />" },
        ],
        options: [
          { name: 'steps', type: '{ id, label, status?, disabled? }[]', does: KitCopy.t('docs.tabs.eachStepAndHowFar') },
          { name: 'value, onChange', type: 'string, (id) => void', does: KitCopy.t('docs.tabs.theOpenStepAndWhat') },
        ],
      },
    ];
  }
}
