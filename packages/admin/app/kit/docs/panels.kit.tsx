import { KitCopy } from '@/app/kit/kit-copy';
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
        <Button variant={ButtonVariant.SECONDARY} onClick={this.raise(NotificationType.SUCCESS, 'Saved', 'The product was saved.')}>{KitCopy.t('docs.panels.success')}</Button>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.raise(NotificationType.ERROR, 'Not saved', 'The price is required.')}>{KitCopy.t('docs.panels.error')}</Button>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.raise(NotificationType.INFO, 'Heads up', 'A new version is available.')}>{KitCopy.t('docs.panels.info')}</Button>
      </>
    );
  }
}

export class PanelsKit {
  static docs(): KitDoc[] {
    return [
      {
        slug: 'toast', name: 'Toast', group: KitCopy.t('docs.panels.feedback'),
        intro: KitCopy.t('docs.panels.aPassingMessageAtThe'),
        from: "this.context.notify(NotificationType.SUCCESS, 'Saved', 'The product was saved.');",
        examples: [
          { title: KitCopy.t('docs.panels.kinds'), text: KitCopy.t('docs.panels.pressOneToRaiseIt'), demo: <ToastButtons />, code: "notify(NotificationType.SUCCESS, 'Saved', 'The product was saved.');\nnotify(NotificationType.ERROR, 'Not saved', 'The price is required.');\nnotify(NotificationType.INFO, 'Heads up', 'A new version is available.');" },
        ],
        options: [
          { name: 'type', type: 'NotificationType', does: KitCopy.t('docs.panels.successErrorOrInfo') },
          { name: 'title, message', type: 'string', does: KitCopy.t('docs.panels.whatHappenedInAFew') },
        ],
      },
      {
        slug: 'stat-card', name: 'StatCard', group: KitCopy.t('docs.panels.data'),
        intro: KitCopy.t('docs.panels.oneFigureThePageIs'),
        from: "import { StatCard } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.panels.risingFallingPlain'), demo: <><div className="fc-kitdoc__cell"><StatCard title={KitCopy.t('docs.panels.orders')} value="128" icon={<FrameworkIcons.Clock size={18} />} trend={{ value: 12, isPositive: true }} /></div><div className="fc-kitdoc__cell"><StatCard title={KitCopy.t('docs.panels.returns')} value="3" icon={<FrameworkIcons.Refresh size={18} />} trend={{ value: 2, isPositive: false }} /></div><div className="fc-kitdoc__cell"><StatCard title={KitCopy.t('docs.panels.products')} value="64" icon={<FrameworkIcons.Plugins size={18} />} /></div></>, code: '<StatCard title="Orders" value="128" icon={<Icon />} trend={{ value: 12, isPositive: true }} />' },
          { title: KitCopy.t('docs.panels.withALineUnderThe'), flush: true, text: KitCopy.t('docs.panels.columnsLaysCardsSideBy'), demo: <Columns count={3}><StatCard title={KitCopy.t('docs.panels.pluginsIsolated')} value="2 / 2" icon={<FrameworkIcons.Plugins size={15} />} note="Active plugins running in their own process." /><StatCard title={KitCopy.t('docs.panels.threatAlerts')} value="0" icon={<FrameworkIcons.Check size={15} />} tone="success" note="Policy violations (24h)" /><StatCard title={KitCopy.t('docs.panels.threatAlerts')} value="4" icon={<FrameworkIcons.Alert size={15} />} tone="danger" note="Policy violations (24h)" /></Columns>, code: '<Columns count={3}>\n  <StatCard title="Threat alerts" value="0" icon={<Icon size={15} />} tone="success" note="Policy violations (24h)" />\n  …\n</Columns>' },
        ],
        options: [
          { name: 'title, value', type: 'string', does: KitCopy.t('docs.panels.whatIsCountedAndThe') },
          { name: 'icon', type: 'ReactNode', does: KitCopy.t('docs.panels.aQuietIcon') },
          { name: 'Columns count, top', type: '2 | 3, boolean', initial: '2, false', does: KitCopy.t('docs.panels.howManyColumnsTopLets') },
          { name: 'trend', type: '{ value, isPositive }', does: KitCopy.t('docs.panels.theChangeInPercentAnd') },
          { name: 'note', type: 'ReactNode', does: KitCopy.t('docs.panels.oneLineUnderTheFigure') },
          { name: 'tone', type: "success · warning · danger · info", does: KitCopy.t('docs.panels.theColourOfTheIcon') },
        ],
      },
      {
        slug: 'fact-grid', name: 'AdminFactGrid', group: KitCopy.t('docs.panels.data'),
        intro: KitCopy.t('docs.panels.aFewFactsAboutA'),
        from: "import { AdminFactGrid } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.panels.factsOneWithANote'), demo: <div className="fc-kitdoc__cell--wide"><AdminFactGrid facts={[{ key: 'a', label: KitCopy.t('docs.panels.weight'), value: '400 g' }, { key: 'b', label: KitCopy.t('docs.panels.origin'), value: 'Bulgaria' }, { key: 'c', label: KitCopy.t('docs.panels.hsCode'), value: '6109.10', note: 'Checked on export' }]} /></div>, code: "<AdminFactGrid facts={[\n  { key: 'weight', label: 'Weight', value: '400 g' },\n  { key: 'hs', label: 'HS code', value: '6109.10', note: 'Checked on export' },\n]} />" },
        ],
        options: [
          { name: 'facts', type: '{ key, label, value, note? }[]', does: KitCopy.t('docs.panels.theFactsInOrder') },
        ],
      },
      {
        slug: 'admin-panel', name: 'AdminPanel', group: KitCopy.t('docs.panels.layout'),
        intro: KitCopy.t('docs.panels.aTitledPanelAPlugin'),
        from: "import { AdminPanel } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.panels.withADescriptionAndAn'), flush: true, demo: <AdminPanel title={KitCopy.t('docs.panels.shipments')} description={KitCopy.t('docs.panels.whatHasBeenSentFor')} actions={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.panels.createShipment')}</Button>}><p className="fc-field-note">{KitCopy.t('docs.panels.thePanelSBody')}</p></AdminPanel>, code: '<AdminPanel title="Shipments" description="What has been sent for this order."\n  actions={<Button variant={ButtonVariant.SECONDARY}>Create shipment</Button>}>\n  …\n</AdminPanel>' },
          { title: KitCopy.t('docs.panels.titleOnly'), flush: true, demo: <AdminPanel title={KitCopy.t('docs.panels.notes')}><p className="fc-field-note">{KitCopy.t('docs.panels.thePanelSBody')}</p></AdminPanel>, code: '<AdminPanel title="Notes">…</AdminPanel>' },
        ],
        options: [
          { name: 'title, description', type: 'string', does: KitCopy.t('docs.panels.thePanelSNameAnd') },
          { name: 'icon', type: 'ReactNode', does: KitCopy.t('docs.panels.anIconBeforeTheName') },
          { name: 'actions', type: 'ReactNode', does: KitCopy.t('docs.panels.buttonsAtTheEndOf') },
        ],
      },
    ];
  }
}
