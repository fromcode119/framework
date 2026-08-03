import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { AdminAssistantPageController } from '@ai/admin-assistant-page/admin-assistant-page-controller';

export class AdminAssistantPage extends PureReactor {
  render(): ReactNode {
    return <AdminAssistantPageController />;
  }
}
