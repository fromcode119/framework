import { KitCopy } from '@/app/kit/kit-copy';
import { Alert } from '@/components/ui/view/alert.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

export class AlertKit {
  static doc(): KitDoc {
    return {
      slug: 'alert', name: 'Alert', group: KitCopy.t('docs.alert.feedback'),
      intro: KitCopy.t('docs.alert.aNoteAtTheHead'),
      from: "import { Alert } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.alert.tones'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><Alert tone="info">{KitCopy.t('docs.alert.aNewVersionIsAvailable')}</Alert><Alert tone="success">{KitCopy.t('docs.alert.everythingIsUpToDate')}</Alert><Alert tone="warning">{KitCopy.t('docs.alert.twoPluginsWaitForYour')}</Alert><Alert tone="danger">{KitCopy.t('docs.alert.onePluginFailedToStart')}</Alert></div>, code: '<Alert tone="info">A new version is available.</Alert>\n<Alert tone="success">Everything is up to date.</Alert>\n<Alert tone="warning">Two plugins wait for your approval.</Alert>\n<Alert tone="danger">One plugin failed to start.</Alert>' },
        { title: KitCopy.t('docs.alert.withATitle'), demo: <div className="fc-kitdoc__cell--wide"><Alert tone="info" title={KitCopy.t('docs.alert.updateAvailable')}>{KitCopy.t('docs.alert.version02561Can')}</Alert></div>, code: '<Alert tone="info" title="Update available">Version 0.2.561 can be installed.</Alert>' },
        { title: KitCopy.t('docs.alert.withActions'), text: KitCopy.t('docs.alert.whatCanBeDoneAbout'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><Alert tone="warning" action={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.alert.reviewAndApprove')}</Button>}>{KitCopy.t('docs.alert.twoPluginsWaitForYour2')}</Alert><Alert tone="info" title={KitCopy.t('docs.alert.updateAvailable')} action={<><Button variant={ButtonVariant.GHOST}>{KitCopy.t('docs.alert.dismiss')}</Button><Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.alert.viewDetails')}</Button></>}>{KitCopy.t('docs.alert.aNewVersionIsAvailable')}</Alert></div>, code: '<Alert tone="warning" action={<Button variant={ButtonVariant.SECONDARY}>Review and approve</Button>}>\n  Two plugins wait for your approval.\n</Alert>' },
      ],
      options: [
        { name: 'tone', type: "info · success · warning · danger", initial: 'info', does: KitCopy.t('docs.alert.theIconAndItsColour') },
        { name: 'title', type: 'ReactNode', does: KitCopy.t('docs.alert.aFewStrongWordsBefore') },
        { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.alert.whatIsToBeKnown') },
        { name: 'action', type: 'ReactNode', does: KitCopy.t('docs.alert.buttonsAtTheEnd') },
        { name: 'role', type: "alert · status", initial: 'by tone', does: KitCopy.t('docs.alert.howAScreenReaderAnnounces') },
      ],
    };
  }
}
