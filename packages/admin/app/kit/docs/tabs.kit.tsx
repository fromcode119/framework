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
    const plain = [{ id: 'overview', label: 'Overview' }, { id: 'settings', label: 'Configuration' }, { id: 'security', label: 'Security' }];
    return [
      {
        slug: 'tabs', name: 'Tabs', group: 'Navigation',
        intro: 'Parts of one page, one shown at a time. Tabs have the control’s corner (6px), never a pill.',
        from: "import { Tabs } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Plain', text: 'As a filter over a list or a switch inside a card.', demo: TabsKit.tabs({ label: 'Part', tabs: plain }, 'overview'), code: "<Tabs label=\"Part\" value={tab} onChange={setTab}\n  tabs={[{ id: 'overview', label: 'Overview' }, { id: 'settings', label: 'Configuration' }]} />" },
          { title: 'With counts', demo: TabsKit.tabs({ label: 'Filter', tabs: [{ id: 'all', label: 'All', count: 12 }, { id: 'active', label: 'Active', count: 9 }, { id: 'off', label: 'Off', count: 3 }] }, 'all'), code: "tabs={[{ id: 'all', label: 'All', count: 12 }, …]}" },
          { title: 'With icons and a disabled tab', demo: TabsKit.tabs({ label: 'Part', tabs: [{ id: 'a', label: 'General', icon: <FrameworkIcons.Settings size={14} /> }, { id: 'b', label: 'Media', icon: <FrameworkIcons.Image size={14} /> }, { id: 'c', label: 'History', disabled: true }] }, 'a'), code: "tabs={[{ id: 'a', label: 'General', icon: <FrameworkIcons.Settings size={14} /> }, { id: 'c', label: 'History', disabled: true }]}" },
          { title: 'Heading a page', flush: true, text: '`variant="bar"` is the row under a page’s header: full width with a line under it. A tab marked `end` stands at the far side.', demo: TabsKit.tabs({ label: 'Page', variant: 'bar', tabs: [...plain.slice(0, 2), { id: 'security', label: 'Security', end: true }, { id: 'limits', label: 'Resource limits', end: true }] }, 'settings'), code: "<Tabs variant=\"bar\" value={tab} onChange={setTab}\n  tabs={[…, { id: 'security', label: 'Security', end: true }]} />" },
          { title: 'Two levels', flush: true, text: 'The second level is `variant="second"` directly under the bar. It starts on the same edge, 12px under the bar and 16px over what it opens; when the tabs do not fit a line they wrap.', demo: <div className="fc-tabstack">{TabsKit.tabs({ label: 'Page', variant: 'bar', tabs: plain }, 'settings')}{TabsKit.tabs({ label: 'Section', variant: 'second', tabs: ['General', 'Taxes', 'Wallets', 'Exchange rates', 'Invoices'].map((label) => ({ id: label, label })) }, 'General')}</div>, code: '<Tabs variant="bar" … />\n<Tabs variant="second" … />' },
        ],
        options: [
          { name: 'tabs', type: '{ id, label, count?, icon?, disabled?, end? }[]', does: 'The tabs. `end` sends a tab to the far side of a bar.' },
          { name: 'value, onChange', type: 'string, (id) => void', does: 'The open tab and what happens on a choice.' },
          { name: 'variant', type: "'bar' | 'second'", initial: 'plain', does: 'The page’s own row / the level under it.' },
          { name: 'label', type: 'string', does: 'The accessible name of the row.' },
        ],
      },
      {
        slug: 'progress-tabs', name: 'ProgressTabs', group: 'Navigation',
        intro: 'The steps of something filled in over several screens, each showing how far it has got.',
        from: "import { ProgressTabs } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Steps', flush: true, demo: <KitPlay initial="organize">{(value, set) => <ProgressTabs label="Steps" value={value} onChange={set} steps={[{ id: 'details', label: 'Details', status: 'completed' }, { id: 'organize', label: 'Organize', status: 'in-progress' }, { id: 'variants', label: 'Variants', status: 'not-started' }, { id: 'inventory', label: 'Inventory', status: 'not-started', disabled: true }]} />}</KitPlay>, code: "<ProgressTabs value={step} onChange={setStep} steps={[\n  { id: 'details', label: 'Details', status: 'completed' },\n  { id: 'organize', label: 'Organize', status: 'in-progress' },\n  { id: 'variants', label: 'Variants', status: 'not-started' },\n]} />" },
        ],
        options: [
          { name: 'steps', type: '{ id, label, status?, disabled? }[]', does: "Each step and how far it is: 'not-started', 'in-progress' or 'completed'." },
          { name: 'value, onChange', type: 'string, (id) => void', does: 'The open step and what happens on a choice.' },
        ],
      },
    ];
  }
}
