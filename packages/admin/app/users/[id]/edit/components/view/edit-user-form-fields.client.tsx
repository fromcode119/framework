import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IEditUserFormData } from '@/app/users/[id]/edit/interfaces/edit-user-form-data.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditUserFormFields extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<EditUserFormFields, 'formData' | 'errors' | 'onPatch' | 'selfService' | 'identityLocked'>;

  @prop declare formData: IEditUserFormData;
  @prop declare errors: Record<string, string>;
  /**
   * Your own account without `users:manage`: your name is yours to change, your password with your
   * current one; email, username, status and forced reset stay with an administrator.
   */
  @prop declare selfService?: boolean;
  @prop declare onPatch: (patch: Partial<IEditUserFormData>) => void;
  /**
   * A member whose sign-in account is shared with another site (or is the platform admin): from inside
   * this site its email, name and password are read-only, and the API refuses a change to them.
   */
  @prop declare identityLocked?: boolean;

  render(): ReactNode {
    const { formData, errors, onPatch } = this;
    const locked = Boolean(this.identityLocked);
    return (
      <>
        <Card title={AdminI18n.t('users.profileDetails')}>
           {locked ? (
           <p className="text-xs font-bold text-slate-500 mt-2 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
             {AdminI18n.t('users.identityLockedNotice')}
           </p>
           ) : null}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.eMailAddress')}</label>
                 <Input
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    disabled={this.selfService || locked}
                    required
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.username')}</label>
                 <Input
                    placeholder={AdminI18n.t('users.usernamePlaceholder')}
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                    disabled={this.selfService || locked}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.firstName')}</label>
                 <Input
                    placeholder={AdminI18n.t('users.john')}
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                    disabled={locked}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.lastName')}</label>
                 <Input
                    placeholder={AdminI18n.t('users.doe')}
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                    disabled={locked}
                 />
              </div>
           </div>
        </Card>

        {locked ? null : (
        <Card title={AdminI18n.t('users.securityCredentials')} icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
           <p className="text-xs font-bold text-slate-500 mb-6 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
             {AdminI18n.t('users.leavePasswordFieldsBlankIf')}
           </p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              {this.selfService ? (
              <div className="space-y-2 md:col-span-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.currentPassword')}</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.currentPassword ?? ''}
                    onChange={(e) => onPatch({ currentPassword: e.target.value })}
                    error={errors.currentPassword}
                 />
              </div>
              ) : null}
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.newPassword')}</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
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
                 />
              </div>
           </div>
        </Card>
        )}

        {this.selfService ? null : (
        <Card title={AdminI18n.t('users.accountAccessControls')} icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.accountStatus')}</label>
                 <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={formData.accountStatus === 'active' ? ButtonVariant.PRIMARY : ButtonVariant.OUTLINE}
                      size={FieldSize.SM}
                      className="rounded-lg"
                      onClick={() => onPatch({ accountStatus: 'active' })}
                    >
                      {AdminI18n.t('users.active')}
                    </Button>
                    <Button
                      type="button"
                      variant={formData.accountStatus === 'suspended' ? ButtonVariant.PRIMARY : ButtonVariant.OUTLINE}
                      size={FieldSize.SM}
                      className="rounded-lg"
                      onClick={() => onPatch({ accountStatus: 'suspended' })}
                    >
                      {AdminI18n.t('users.suspended')}
                    </Button>
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">{AdminI18n.t('users.forcePasswordReset')}</label>
                 <div className="pt-2">
                   <Switch
                     checked={formData.forcePasswordReset ?? false}
                     onChange={(checked) => onPatch({ forcePasswordReset: checked })}
                   />
                 </div>
              </div>
           </div>
        </Card>
        )}
      </>
    );
  }
}
