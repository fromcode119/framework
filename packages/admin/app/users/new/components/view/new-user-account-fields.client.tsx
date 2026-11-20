import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import type { INewUserFormData } from '@/app/users/new/interfaces/new-user-form-data.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
export class NewUserAccountFields extends PureReactor {
  @prop declare formData: INewUserFormData;
  @prop declare errors: Record<string, string>;
  @prop declare onPatch: (patch: Partial<INewUserFormData>) => void;

  render(): ReactNode {
    const { formData, errors, onPatch } = this;
    return (
      <>
        <Card title={AdminI18n.t('users.accountDetails')}>
           <div className="fc-form-grid">
              <Input label={AdminI18n.t('users.eMailAddress')}
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    required
                 />
              <Input label={AdminI18n.t('users.username')}
                    placeholder={AdminI18n.t('users.usernamePlaceholder')}
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                 />
              <Input label={AdminI18n.t('users.firstName')}
                    placeholder={AdminI18n.t('users.firstName2')}
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                 />
              <Input label={AdminI18n.t('users.lastName')}
                    placeholder={AdminI18n.t('users.lastName2')}
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                 />
           </div>
        </Card>

        <Card title={AdminI18n.t('users.securitySetup')}>
           <div className="fc-form-grid">
              <Input label={AdminI18n.t('users.initialPassword')}
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                    error={errors.password}
                    required
                 />
              <Input label={AdminI18n.t('users.confirmPassword')}
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => onPatch({ confirmPassword: e.target.value })}
                    error={errors.confirmPassword}
                    required
                 />
           </div>
        </Card>
      </>
    );
  }
}
