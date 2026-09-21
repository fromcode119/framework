import type { ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Select } from '@/components/ui/view/select.client';

/**
 * What each of this site's hosts answers with.
 *
 * It exists to delete a piece of magic. The gateway used to decide by reading the hostname — a host
 * beginning `api.` went to the api, everything else followed the site's kind — and no screen said
 * so. Name a shop's alias `api.shop.com` and it silently stopped serving the shop; want a dedicated
 * api host and you had to know that one prefix was special.
 *
 * So the point of this control is not that it adds a capability. It is that the answer is now
 * VISIBLE: every host is listed with what it serves, and the default is shown as a default rather
 * than left blank, because "storefront, because this is a site" is a real answer an operator should
 * be able to read without knowing the routing rules.
 */
export class SiteHostRoles extends AdminComponent<{
  /** Every host this site answers on, primary first. */
  hosts: string[];
  /** Host -> role, where one has been chosen. */
  roles: Record<string, string>;
  /** A workspace defaults to the console, a site to its storefront. */
  isWorkspace: boolean;
  onChange: (roles: Record<string, string>) => void;
}> {
  /** The default is offered as a real choice, so picking it back is possible and says what it means. */
  private get options(): Array<{ value: string; label: string }> {
    const fallback = this.props.isWorkspace ? 'Admin console' : 'Storefront';
    return [
      { value: '', label: `Default for this ${this.props.isWorkspace ? 'workspace' : 'site'} — ${fallback}` },
      { value: 'storefront', label: 'Storefront' },
      { value: 'admin', label: 'Admin console' },
      { value: 'api', label: 'API' },
    ];
  }

  @bound private onRole(host: string, value: string): void {
    const next = { ...this.props.roles };
    // Choosing the default REMOVES the entry rather than writing the default down. A stored value
    // that merely repeats the rule would stop following it the day the site's kind changed.
    if (value) next[host.toLowerCase()] = value; else delete next[host.toLowerCase()];
    this.props.onChange(next);
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const hosts = this.props.hosts.filter((host) => host.trim().length > 0);
    if (!hosts.length) return null;

    return (
      <div className="mt-4">
        <label className={`block text-xs font-semibold mb-1 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
          What each host serves
        </label>
        <p className={`text-[11px] mb-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          Chosen here, never guessed from the name. A host called <code>api.example.com</code> serves the
          storefront like any other unless you say otherwise.
        </p>
        <div className="flex flex-col gap-2">
          {hosts.map((host) => (
            <div key={host} className="grid grid-cols-[1fr_auto] items-center gap-2">
              <span className={`text-xs font-mono truncate ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{host}</span>
              <Select
                theme={this.theme}
                value={this.props.roles[host.toLowerCase()] ?? ''}
                onChange={(value: string) => this.onRole(host, value)}
                options={this.options}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
}
