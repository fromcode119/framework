import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import type { ISetupAccountErrors } from '@/app/setup/interfaces/setup-account-errors.interface';
import { Alert } from '@/components/ui/view/alert.client';

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
        />
        <Input
          label={this.text('setup.account.password')}
          type="password"
          required
          autoComplete="new-password"
          value={this.password}
          onChange={this.handlePassword}
          error={this.errors.password}
        />
        <Input
          label={this.text('setup.account.confirmPassword')}
          type="password"
          required
          autoComplete="new-password"
          value={this.confirmPassword}
          onChange={this.handleConfirmPassword}
          error={this.errors.confirmPassword}
        />

        <Alert tone="info" title={this.text('setup.account.noticeTitle')}>{this.text('setup.account.noticeBody')}</Alert>
      </div>
    );
  }
}
