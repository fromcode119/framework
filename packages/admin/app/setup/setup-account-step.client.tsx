import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { AdminClass } from '@/lib/admin-class';
import type { ISetupAccountErrors } from '@/app/setup/setup-account-errors.interface';

/**
 * Step two: the administrator account.
 *
 * Only the two things the browser can decide on its own are checked here — a field left empty, and
 * two passwords that differ. Password STRENGTH is deliberately not re-implemented: the API holds the
 * policy, this form used to insist on "min 6 characters" while the server enforced something else,
 * and two rules that disagree mean one of them is a lie. The server's message is shown as-is.
 */
export class SetupAccountStep extends PureReactor {
  @prop declare locale: string;
  @prop declare email: string;
  @prop declare password: string;
  @prop declare confirmPassword: string;
  @prop declare errors: ISetupAccountErrors;
  @prop declare onEmailChange: (value: string) => void;
  @prop declare onPasswordChange: (value: string) => void;
  @prop declare onConfirmPasswordChange: (value: string) => void;

  @bound
  private handleEmail(event: ChangeEvent<HTMLInputElement>): void {
    this.onEmailChange(event.target.value);
  }

  @bound
  private handlePassword(event: ChangeEvent<HTMLInputElement>): void {
    this.onPasswordChange(event.target.value);
  }

  @bound
  private handleConfirmPassword(event: ChangeEvent<HTMLInputElement>): void {
    this.onConfirmPasswordChange(event.target.value);
  }

  private text(key: string): string {
    return AdminDictionary.translate(this.locale, key);
  }

  render(): ReactNode {
    return (
      <div className="space-y-5">
        <Input
          label={this.text('setup.account.email')}
          type="email"
          required
          autoComplete="email"
          value={this.email}
          onChange={this.handleEmail}
          error={this.errors.email}
          className="py-3 text-sm"
        />
        <Input
          label={this.text('setup.account.password')}
          type="password"
          required
          autoComplete="new-password"
          value={this.password}
          onChange={this.handlePassword}
          error={this.errors.password}
          className="py-3 text-sm"
        />
        <Input
          label={this.text('setup.account.confirmPassword')}
          type="password"
          required
          autoComplete="new-password"
          value={this.confirmPassword}
          onChange={this.handleConfirmPassword}
          error={this.errors.confirmPassword}
          className="py-3 text-sm"
        />

        <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-indigo-500/5`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500 text-white mt-0.5">
              <FrameworkIcons.Shield size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold mb-1 tracking-wide text-indigo-900 dark:text-indigo-300">
                {this.text('setup.account.noticeTitle')}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {this.text('setup.account.noticeBody')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
