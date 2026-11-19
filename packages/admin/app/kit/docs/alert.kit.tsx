import { Alert } from '@/components/ui/view/alert.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

export class AlertKit {
  static doc(): KitDoc {
    return {
      slug: 'alert', name: 'Alert', group: 'Feedback',
      intro: 'A note at the head of a page or a card: something the reader should know before going on. It stays until its cause is gone — for a passing message use a toast.',
      from: "import { Alert } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'Tones', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><Alert tone="info">A new version is available.</Alert><Alert tone="success">Everything is up to date.</Alert><Alert tone="warning">Two plugins wait for your approval.</Alert><Alert tone="danger">One plugin failed to start.</Alert></div>, code: '<Alert tone="info">A new version is available.</Alert>\n<Alert tone="success">Everything is up to date.</Alert>\n<Alert tone="warning">Two plugins wait for your approval.</Alert>\n<Alert tone="danger">One plugin failed to start.</Alert>' },
        { title: 'With a title', demo: <div className="fc-kitdoc__cell--wide"><Alert tone="info" title="Update available">Version 0.2.561 can be installed.</Alert></div>, code: '<Alert tone="info" title="Update available">Version 0.2.561 can be installed.</Alert>' },
        { title: 'With actions', text: 'What can be done about it stands at the end, the quiet action first.', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><Alert tone="warning" action={<Button variant={ButtonVariant.SECONDARY}>Review and approve</Button>}>Two plugins wait for your approval. They stay off until an admin approves them.</Alert><Alert tone="info" title="Update available" action={<><Button variant={ButtonVariant.GHOST}>Dismiss</Button><Button variant={ButtonVariant.SECONDARY}>View details</Button></>}>A new version is available.</Alert></div>, code: '<Alert tone="warning" action={<Button variant={ButtonVariant.SECONDARY}>Review and approve</Button>}>\n  Two plugins wait for your approval.\n</Alert>' },
      ],
      options: [
        { name: 'tone', type: "'info' | 'success' | 'warning' | 'danger'", initial: 'info', does: 'The icon and its colour.' },
        { name: 'title', type: 'ReactNode', does: 'A few strong words before the text.' },
        { name: 'children', type: 'ReactNode', does: 'What is to be known.' },
        { name: 'action', type: 'ReactNode', does: 'Buttons at the end.' },
        { name: 'role', type: "'alert' | 'status'", initial: 'by tone', does: 'How a screen reader announces it.' },
      ],
    };
  }
}
