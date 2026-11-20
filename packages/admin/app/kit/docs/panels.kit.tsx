import { FrameworkIcons } from '@fromcode119/react';
import { Reactor } from '@fromcode119/react-class-components';
import type { ReactNode } from 'react';
import { AdminPanel } from '@/components/ui/view/admin-panel.client';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { Columns } from '@/components/ui/view/columns.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import type { KitDoc } from '@/app/kit/kit-doc';

/** Buttons that raise each kind of toast through the console's own notifier. */
class ToastButtons extends Reactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;

  private raise(type: NotificationType, title: string, message: string): () => void {
    return () => this.context?.notify(type, title, message);
  }

  render(): ReactNode {
    return (
      <>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.raise(NotificationType.SUCCESS, 'Saved', 'The product was saved.')}>Success</Button>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.raise(NotificationType.ERROR, 'Not saved', 'The price is required.')}>Error</Button>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.raise(NotificationType.INFO, 'Heads up', 'A new version is available.')}>Info</Button>
      </>
    );
  }
}

export class PanelsKit {
  static docs(): KitDoc[] {
    return [
      {
        slug: 'toast', name: 'Toast', group: 'Feedback',
        intro: 'A passing message at the corner of the screen: something was done, or could not be. It leaves by itself — for something that must stay until dealt with, use Alert.',
        from: "this.context.notify(NotificationType.SUCCESS, 'Saved', 'The product was saved.');",
        examples: [
          { title: 'Kinds', text: 'Press one to raise it.', demo: <ToastButtons />, code: "notify(NotificationType.SUCCESS, 'Saved', 'The product was saved.');\nnotify(NotificationType.ERROR, 'Not saved', 'The price is required.');\nnotify(NotificationType.INFO, 'Heads up', 'A new version is available.');" },
        ],
        options: [
          { name: 'type', type: 'NotificationType', does: 'SUCCESS, ERROR or INFO.' },
          { name: 'title, message', type: 'string', does: 'What happened, in a few words, and one sentence more.' },
        ],
      },
      {
        slug: 'stat-card', name: 'StatCard', group: 'Data',
        intro: 'One figure the page is about, with its name and where it is heading.',
        from: "import { StatCard } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Rising, falling, plain', demo: <><div className="fc-kitdoc__cell"><StatCard title="Orders" value="128" icon={<FrameworkIcons.Clock size={18} />} trend={{ value: 12, isPositive: true }} /></div><div className="fc-kitdoc__cell"><StatCard title="Returns" value="3" icon={<FrameworkIcons.Refresh size={18} />} trend={{ value: 2, isPositive: false }} /></div><div className="fc-kitdoc__cell"><StatCard title="Products" value="64" icon={<FrameworkIcons.Plugins size={18} />} /></div></>, code: '<StatCard title="Orders" value="128" icon={<Icon />} trend={{ value: 12, isPositive: true }} />' },
          { title: 'With a line under the figure, in columns', flush: true, text: '`Columns` lays cards side by side — two or three — and drops to one column on a narrow screen.', demo: <Columns count={3}><StatCard title="Plugins isolated" value="2 / 2" icon={<FrameworkIcons.Plugins size={15} />} note="Active plugins running in their own process." /><StatCard title="Threat alerts" value="0" icon={<FrameworkIcons.Check size={15} />} tone="success" note="Policy violations (24h)" /><StatCard title="Threat alerts" value="4" icon={<FrameworkIcons.Alert size={15} />} tone="danger" note="Policy violations (24h)" /></Columns>, code: '<Columns count={3}>\n  <StatCard title="Threat alerts" value="0" icon={<Icon size={15} />} tone="success" note="Policy violations (24h)" />\n  …\n</Columns>' },
        ],
        options: [
          { name: 'title, value', type: 'string', does: 'What is counted and the figure, already formatted.' },
          { name: 'icon', type: 'ReactNode', does: 'A quiet icon.' },
          { name: 'Columns count, top', type: '2 | 3, boolean', initial: '2, false', does: 'How many columns; `top` lets each be as tall as its own content.' },
          { name: 'trend', type: '{ value, isPositive }', does: 'The change, in percent, and whether it is good.' },
          { name: 'note', type: 'ReactNode', does: 'One line under the figure.' },
          { name: 'tone', type: "success · warning · danger · info", does: 'The colour of the icon when the figure is good or bad news.' },
        ],
      },
      {
        slug: 'fact-grid', name: 'AdminFactGrid', group: 'Data',
        intro: 'A few facts about a thing, each a label over a value, laid out in columns.',
        from: "import { AdminFactGrid } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Facts, one with a note', demo: <div className="fc-kitdoc__cell--wide"><AdminFactGrid facts={[{ key: 'a', label: 'Weight', value: '400 g' }, { key: 'b', label: 'Origin', value: 'Bulgaria' }, { key: 'c', label: 'HS code', value: '6109.10', note: 'Checked on export' }]} /></div>, code: "<AdminFactGrid facts={[\n  { key: 'weight', label: 'Weight', value: '400 g' },\n  { key: 'hs', label: 'HS code', value: '6109.10', note: 'Checked on export' },\n]} />" },
        ],
        options: [
          { name: 'facts', type: '{ key, label, value, note? }[]', does: 'The facts, in order.' },
        ],
      },
      {
        slug: 'admin-panel', name: 'AdminPanel', group: 'Layout',
        intro: 'A titled panel a plugin puts on a page that is not its own, with its actions at the end of its head.',
        from: "import { AdminPanel } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'With a description and an action', flush: true, demo: <AdminPanel title="Shipments" description="What has been sent for this order." actions={<Button variant={ButtonVariant.SECONDARY}>Create shipment</Button>}><p className="fc-field-note">The panel’s body.</p></AdminPanel>, code: '<AdminPanel title="Shipments" description="What has been sent for this order."\n  actions={<Button variant={ButtonVariant.SECONDARY}>Create shipment</Button>}>\n  …\n</AdminPanel>' },
          { title: 'Title only', flush: true, demo: <AdminPanel title="Notes"><p className="fc-field-note">The panel’s body.</p></AdminPanel>, code: '<AdminPanel title="Notes">…</AdminPanel>' },
        ],
        options: [
          { name: 'title, description', type: 'string', does: 'The panel’s name and a line under it.' },
          { name: 'icon', type: 'ReactNode', does: 'An icon before the name.' },
          { name: 'actions', type: 'ReactNode', does: 'Buttons at the end of the head.' },
        ],
      },
    ];
  }
}
