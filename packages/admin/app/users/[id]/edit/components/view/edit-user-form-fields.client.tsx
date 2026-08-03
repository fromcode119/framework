import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IEditUserFormData } from '@/app/users/[id]/edit/interfaces/edit-user-form-data.interface';

export class EditUserFormFields extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<EditUserFormFields, 'formData' | 'errors' | 'onPatch'>;

  @prop declare formData: IEditUserFormData;
  @prop declare errors: Record<string, string>;
  @prop declare onPatch: (patch: Partial<IEditUserFormData>) => void;

  render(): ReactNode {
    const { formData, errors, onPatch } = this;
    return (
      <>
        <Card title="Profile Details">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">E-Mail Address</label>
                 <Input
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    required
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Username</label>
                 <Input
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">First Name</label>
                 <Input
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Last Name</label>
                 <Input
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                 />
              </div>
           </div>
        </Card>

        <Card title="Security Credentials" icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
           <p className="text-xs font-bold text-slate-500 mb-6 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
             Leave password fields blank if you do not wish to change the current password.
           </p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">New Password</label>
                 <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Confirm Password</label>
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

        <Card title="Account Access Controls" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Account Status</label>
                 <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={formData.accountStatus === 'active' ? ButtonVariant.PRIMARY : ButtonVariant.OUTLINE}
                      size={FieldSize.SM}
                      className="rounded-lg"
                      onClick={() => onPatch({ accountStatus: 'active' })}
                    >
                      Active
                    </Button>
                    <Button
                      type="button"
                      variant={formData.accountStatus === 'suspended' ? ButtonVariant.PRIMARY : ButtonVariant.OUTLINE}
                      size={FieldSize.SM}
                      className="rounded-lg"
                      onClick={() => onPatch({ accountStatus: 'suspended' })}
                    >
                      Suspended
                    </Button>
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Force Password Reset</label>
                 <div className="pt-2">
                   <Switch
                     checked={formData.forcePasswordReset ?? false}
                     onChange={(checked) => onPatch({ forcePasswordReset: checked })}
                   />
                 </div>
              </div>
           </div>
        </Card>
      </>
    );
  }
}
