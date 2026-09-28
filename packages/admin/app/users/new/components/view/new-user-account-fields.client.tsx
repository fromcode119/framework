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
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.eMailAddress')}</label>
                 <Input
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    required
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.username')}</label>
                 <Input
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.firstName')}</label>
                 <Input
                    placeholder={AdminI18n.t('users.firstName2')}
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.lastName')}</label>
                 <Input
                    placeholder={AdminI18n.t('users.lastName2')}
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                    className="h-11 rounded-xl"
                 />
              </div>
           </div>
        </Card>

        <Card title={AdminI18n.t('users.securitySetup')}>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.initialPassword')}</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                    error={errors.password}
                    required
                    className="h-11 rounded-xl"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.confirmPassword')}</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => onPatch({ confirmPassword: e.target.value })}
                    error={errors.confirmPassword}
                    required
                    className="h-11 rounded-xl"
                 />
              </div>
           </div>
        </Card>
      </>
    );
  }
}
