import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { Tabs } from '@/components/ui/view/tabs.client';
import { Switch } from '@/components/ui/view/switch.client';
import type { INewUserFormData } from '@/app/users/new/interfaces/new-user-form-data.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AccountStatus } from '@/app/users/enums/account-status.enum';

export class NewUserAccessControls extends PureReactor {
  @prop declare formData: INewUserFormData;
  @prop declare onPatch: (patch: Partial<INewUserFormData>) => void;

  render(): ReactNode {
    const { formData, onPatch } = this;
    return (
      <Card title={AdminI18n.t('users.accessControls')} noPadding>
        <SettingRow title={AdminI18n.t('users.accountStatus')} width={SettingRowWidth.AUTO}>
          <Tabs label={AdminI18n.t('users.accountStatus')} value={AccountStatus.resolve(formData.accountStatus).value} onChange={(value: string) => onPatch({ accountStatus: value })}
            tabs={[{ id: AccountStatus.ACTIVE.value, label: AdminI18n.t('users.active') }, { id: AccountStatus.SUSPENDED.value, label: AdminI18n.t('users.suspended') }]} />
        </SettingRow>
        <SettingRow title={AdminI18n.t('users.forcePasswordReset')} width={SettingRowWidth.AUTO}>
          <Switch checked={formData.forcePasswordReset ?? false} onChange={(checked) => onPatch({ forcePasswordReset: checked })} />
        </SettingRow>
      </Card>
    );
  }
}
