import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';

import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Hint } from '@/components/ui/view/hint.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Grants an existing account access to this site.
 *
 * A drawer because granting access is an ACTION, not a property of the list. It used to be a permanent
 * input, toggle and button welded under the roster, which read as a third thing stacked on the pager
 * with equal weight and left a form sitting open on a page nobody came to fill in a form.
 *
 * The account must already exist: identity is global, so a site cannot mint one. That is stated here
 * rather than discovered from an error after typing an address that has no account.
 */
export class SiteGrantDialog extends AdminComponent {
  declare props: Pick<SiteGrantDialog, 'isOpen' | 'onClose' | 'onConfirm' | 'isLoading'>;

  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (email: string, asAdmin: boolean) => void;
  @prop declare isLoading?: boolean;

  @state email = '';
  @state asAdmin = true;

  componentDidUpdate(prev: Readonly<Record<string, unknown>>): void {
    // A dialog reopened after a grant must not still hold the last address.
    if (prev.isOpen !== this.isOpen && this.isOpen) {
      this.email = '';
      this.asAdmin = true;
    }
  }

  @bound private onEmail(e: ChangeEvent<HTMLInputElement>): void {
    this.email = e.target.value;
  }

  @bound private onRole(checked: boolean): void {
    this.asAdmin = checked;
  }

  @bound private submit(e?: FormEvent): void {
    e?.preventDefault();
    const email = this.email.trim();
    if (email) this.onConfirm(email, this.asAdmin);
  }

  render(): ReactNode {
    // The console's side drawer, like every other form: the address, the role, Cancel and Grant.
    return (
      <EditSheet
        isOpen={this.isOpen}
        title={AdminI18n.t('sites.grantAccess')}
        onClose={this.onClose}
        onSave={this.submit}
        saving={this.isLoading}
        saveLabel={AdminI18n.t('sites.grantAccess')}
        cancelLabel={AdminI18n.t('sites.cancel')}
      >
        <form onSubmit={this.submit} className="fc-form-stack">
          <Hint>{AdminI18n.t('sites.theAccountMustAlreadyExist')}</Hint>
          <Input type="email" label={AdminI18n.t('setup.account.email')} value={this.email} onChange={this.onEmail} placeholder="name@company.com" autoFocus />
          <Switch
            checked={this.asAdmin}
            onChange={this.onRole}
            label={AdminI18n.t('sites.siteAdministrator')}
            description={AdminI18n.t('sites.canAdministerThisSiteTurn')}
          />
        </form>
      </EditSheet>
    );
  }
}
