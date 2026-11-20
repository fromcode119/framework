import { Alert } from '@/components/ui/view/alert.client';
import { Text } from '@/components/ui/view/text.client';
import { NewUserAccessControls } from '@/app/users/new/components/view/new-user-access-controls.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
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
           {locked ? <Alert tone="warning">{AdminI18n.t('users.identityLockedNotice')}</Alert> : null}
           <div className="fc-form-grid">
              <Input label={AdminI18n.t('users.eMailAddress')}
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => onPatch({ email: e.target.value })}
                    disabled={this.selfService || locked}
                    required
                 />
              <Input label={AdminI18n.t('users.username')}
                    placeholder={AdminI18n.t('users.usernamePlaceholder')}
                    value={formData.username}
                    onChange={(e) => onPatch({ username: e.target.value })}
                    disabled={this.selfService || locked}
                 />
              <Input label={AdminI18n.t('users.firstName')}
                    placeholder={AdminI18n.t('users.john')}
                    value={formData.firstName}
                    onChange={(e) => onPatch({ firstName: e.target.value })}
                    disabled={locked}
                 />
              <Input label={AdminI18n.t('users.lastName')}
                    placeholder={AdminI18n.t('users.doe')}
                    value={formData.lastName}
                    onChange={(e) => onPatch({ lastName: e.target.value })}
                    disabled={locked}
                 />
           </div>
        </Card>

        {locked ? null : (
        <Card title={AdminI18n.t('users.securityCredentials')}>
           <Text muted>{AdminI18n.t('users.leavePasswordFieldsBlankIf')}</Text>
           <div className="fc-form-grid">
              {this.selfService ? (
              <Input label={AdminI18n.t('users.currentPassword')}
                    type="password"
                    placeholder="••••••••"
                    value={formData.currentPassword ?? ''}
                    onChange={(e) => onPatch({ currentPassword: e.target.value })}
                    error={errors.currentPassword}
                 />
              ) : null}
              <Input label={AdminI18n.t('users.newPassword')}
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => onPatch({ password: e.target.value })}
                 />
              <Input label={AdminI18n.t('users.confirmPassword')}
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => onPatch({ confirmPassword: e.target.value })}
                    error={errors.confirmPassword}
                 />
           </div>
        </Card>
        )}

        {this.selfService ? null : <NewUserAccessControls formData={formData as any} onPatch={onPatch as any} />}
      </>
    );
  }
}
