import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Switch } from '@/components/ui/view/switch.client';
import type { INewUserFormData } from '@/app/users/new/interfaces/new-user-form-data.interface';

export class NewUserAccessControls extends PureReactor {
  @prop declare formData: INewUserFormData;
  @prop declare onPatch: (patch: Partial<INewUserFormData>) => void;

  render(): ReactNode {
    const { formData, onPatch } = this;
    return (
      <Card title="Access Controls">
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
    );
  }
}
