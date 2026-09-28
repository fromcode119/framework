import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';

/** Whether this site's storefront keeps email addresses and phone numbers out of its HTML. */
export class ContactProtectionCard extends PureReactor {
  declare props: Pick<ContactProtectionCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title="Contact Details">
        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.CONTACT_DETAIL_PROTECTION}
          icon={FrameworkIcons.Mail}
          title="Hide email addresses and phone numbers from harvesters"
          description="Every page is served with its email addresses and international phone numbers (and the text of any tel: link) encoded, so bots that collect them from the HTML find none. Visitors see and click them as normal, and the page still loads as server-rendered. Replaces a CDN's email obfuscation, which should stay off."
        />
      </Card>
    );
  }
}
