import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * The last step: the domain this admin will answer on.
 *
 * PREFILLED, NOT INVENTED. The value is the origin you are standing on — whatever you just used to
 * reach this page, which on a fresh box is usually the server's bare IP — so it is something the
 * operator demonstrably chose, not a guess the platform made up. It is shown and editable rather
 * than written silently, because it decides what the gateway routes by from the next request
 * onward: get it wrong and the admin you are told to go to is the one host that does not answer.
 *
 * Only this one is asked for. A site's domain belongs to the site and is set when the site is
 * created; the api answers on whatever host serves it. Asking for three domains here would be
 * asking the operator to decide two things they do not have yet.
 */
export class SetupDomainStep extends PureReactor {
  @prop declare locale: string;
  @prop declare adminUrl: string;
  @prop declare onAdminUrlChange: (value: string) => void;

  @bound
  private handleAdminUrl(event: ChangeEvent<HTMLInputElement>): void {
    this.onAdminUrlChange(event.target.value);
  }

  private text(key: string): string {
    return AdminDictionary.translate(this.locale, key);
  }

  render(): ReactNode {
    return (
      <div className="space-y-5">
        {/*
          * Said plainly, and on screen rather than in a log nobody reads. Until this form is
          * submitted, anyone who can reach this host can claim this platform — that is true of
          * every install that can be reached before it is configured, and the honest response is to
          * tell the operator so they finish now rather than wander off.
          */}
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
            {this.text('setup.domain.unclaimedWarning')}
          </p>
        </div>

        <div>
          <Input
            id="setup-admin-domain"
            label={this.text('setup.domain.adminUrlLabel')}
            value={this.adminUrl}
            onChange={this.handleAdminUrl}
            placeholder="https://admin.example.com"
            autoComplete="off"
          />
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            {this.text('setup.domain.adminUrlHelp')}
          </p>
        </div>
      </div>
    );
  }
}
