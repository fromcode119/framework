import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';

import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';

/**
 * Grants an existing account access to this site.
 *
 * A dialog because granting access is an ACTION, not a property of the list. It used to be a permanent
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
    if (!this.isOpen) return null;
    const dark = this.theme === ThemeMode.DARK;

    return (
      <RootFramework>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={this.onClose} />
          <form
            onSubmit={this.submit}
            className={`relative w-full max-w-md my-auto rounded-xl border shadow-2xl p-8 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
              dark ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
            }`}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-xl flex-shrink-0 ${dark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
                <FrameworkIcons.Plus size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Grant access</h3>
                <p className={`mt-1 text-sm leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  The account must already exist on this platform — a site cannot create one.
                </p>
              </div>
            </div>

            <Input value={this.email} onChange={this.onEmail} placeholder="name@company.com" />

            <div className="mt-4">
              <Switch
                checked={this.asAdmin}
                onChange={this.onRole}
                label="Site administrator"
                description="Can administer this site. Turn off to grant access without administrative rights."
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant={ButtonVariant.GHOST} onClick={this.onClose} type="button">Cancel</Button>
              <Button type="submit" isLoading={this.isLoading} icon={<FrameworkIcons.Plus size={14} />}>Grant access</Button>
            </div>
          </form>
        </div>
      </RootFramework>
    );
  }
}
