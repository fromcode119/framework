import type { ChangeEvent, ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Input } from '@/components/ui/view/input.client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteHostRoles } from '@/app/sites/components/view/site-host-roles.client';

/**
 * Everything about this site's addresses, in one place: the hosts, and what each one serves.
 *
 * They belong together because they are one decision read twice. Splitting the names from their
 * roles is how the platform ended up inferring a role from a name — a host beginning `api.` became
 * the api, with nothing on screen saying so. Listed side by side, the role is plainly a choice.
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

  @bound private onRoles(hostRoles: Record<string, string>): void {
    this.props.onChange({ hostRoles });
  }

  render(): ReactNode {
    const { values } = this.props;

    return (
      <>
        <Input label="Primary host" value={values.primaryHost} onChange={this.onPrimaryHost} placeholder="acme.example.com" />
        <Input label="Host aliases" value={values.hostAliases} onChange={this.onAliases} placeholder="www.acme.example.com, shop.acme.example.com" />
        <SiteHostRoles
          hosts={[values.primaryHost.trim(), ...values.aliasList]}
          roles={values.hostRoles}
          isWorkspace={values.isWorkspace}
          onChange={this.onRoles}
        />
      </>
    );
  }
}
