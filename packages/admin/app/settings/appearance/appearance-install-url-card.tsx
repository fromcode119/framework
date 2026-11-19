import { Text } from '@/components/ui/view/text.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/** Manual install/update from a package URL — works whether or not the marketplace is configured. */
export class AppearanceInstallUrlCard extends PureReactor {
  @prop declare url: string;
  @prop declare busy: boolean;
  @prop declare onChange: (url: string) => void;
  @prop declare onInstall: () => void;

  @bound
  private handleChange(e: any): void {
    this.onChange(e?.target?.value ?? e);
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.appearance.installFromAPackageUrl')}>
        <div className="fc-stack">
          <div className="fc-field-action">
            <Input value={this.url} onChange={this.handleChange} placeholder="https://…/my-appearance.zip" />
            <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={15} />} onClick={this.onInstall} disabled={this.busy || !this.url.trim()}>{AdminI18n.t('settings.appearance.install')}</Button>
          </div>
          <Text muted><AdminRichText k="settings.appearance.installUrlHint" /></Text>
        </div>
      </Card>
    );
  }
}
