import type React from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { IntegrationsSettingsPageClient } from '@/app/settings/integrations/components/view/integrations-settings-page-client.client';

/** Integrations settings route. */
export class IntegrationsSettingsPage extends Reactor {
  @prop declare searchParams?: Promise<Record<string, string | string[]>>;

  render(): React.ReactNode {
    return <IntegrationsSettingsPageClient searchParams={this.searchParams} />;
  }
}
