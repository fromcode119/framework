import type { ChangeEvent, ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Input } from '@/components/ui/view/input.client';
import { SiteFormValues } from '@/app/sites/site-form-values';

/**
 * The site's hosts: its primary host and its aliases.
 *
 * What each host serves is `SiteHostRoles`, which the form renders as its own full-width block
 * directly below these fields. These two are cells of the form's field grid; the role list is a
 * list of rows and cannot be — as a cell it crushed every hostname to one letter.
 */
export class SiteHostsFields extends AdminComponent<{
  values: SiteFormValues;
  onChange: (patch: Partial<SiteFormValues>) => void;
}> {
  @bound private onPrimaryHost(e: ChangeEvent<HTMLInputElement>): void {
    this.props.onChange({ primaryHost: e.target.value });
  }

  @bound private onAliases(e: ChangeEvent<HTMLInputElement>): void {
    this.props.onChange({ hostAliases: e.target.value });
  }

  render(): ReactNode {
    const { values } = this.props;

    return (
      <>
        <Input label="Primary host" value={values.primaryHost} onChange={this.onPrimaryHost} placeholder="acme.example.com" />
        <Input label="Host aliases" value={values.hostAliases} onChange={this.onAliases} placeholder="www.acme.example.com, shop.acme.example.com" />
      </>
    );
  }
}
