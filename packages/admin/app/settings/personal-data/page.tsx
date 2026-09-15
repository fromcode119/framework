import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { PersonalDataSettingsPage } from '@/app/settings/personal-data/page.client';

/** Personal data settings route. */
export class PersonalDataSettingsRoute extends Reactor {
  render(): ReactNode {
    return <PersonalDataSettingsPage />;
  }
}
