import { TwoFactorMethod } from '@fromcode119/core/client';
import type { FormEvent, ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { LoginTwoFactorFields } from '@/app/login/login-two-factor-fields';
import { LoginPageConstants } from '@/app/login/constants/login-page.constants';
import type { ILoginFieldErrors } from '@/app/login/interfaces/login-field-errors.interface';
import { AdminClass } from '@/lib/admin-class';

export class LoginForm extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<LoginForm, 'email' | 'password' | 'totpToken' | 'recoveryCode' | 'twoFactorMethod' | 'requiresTwoFactor' | 'isLoading' | 'error' | 'fieldErrors' | 'onSubmit' | 'onEmailChange' | 'onPasswordChange' | 'onForgotPassword' | 'onSelectTwoFactorMethod' | 'onTotpTokenChange' | 'onRecoveryCodeChange'>;

  @prop declare email: string;
  @prop declare password: string;
  @prop declare totpToken: string;
  @prop declare recoveryCode: string;
  @prop declare twoFactorMethod: TwoFactorMethod;
  @prop declare requiresTwoFactor: boolean;
  @prop declare isLoading: boolean;
  @prop declare error: string;
  @prop declare fieldErrors: ILoginFieldErrors;
  @prop declare onSubmit: (e: FormEvent) => void;
  @prop declare onEmailChange: (value: string) => void;
  @prop declare onPasswordChange: (value: string) => void;
  @prop declare onForgotPassword: (e: FormEvent) => void;
  @prop declare onSelectTwoFactorMethod: (method: TwoFactorMethod) => void;
  @prop declare onTotpTokenChange: (value: string) => void;
  @prop declare onRecoveryCodeChange: (value: string) => void;

  render(): ReactNode {
    return (
      <div className={`p-8 ${AdminClass.SURFACE}`}>
        {this.error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-semibold animate-in fade-in zoom-in duration-300">
            {this.error}
          </div>
        )}
        <form onSubmit={this.onSubmit} className="space-y-6" noValidate>
          <Input
            label="Email Address"
            placeholder="name@company.com"
            type="email"
            required
            autoComplete="email"
            value={this.email}
            onChange={(e) => this.onEmailChange(e.target.value)}
            error={this.fieldErrors.email}
            className="group"
            inputClassName={LoginPageConstants.loginInputClassName}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Password</label>
              <button type="button" onClick={this.onForgotPassword} className="text-xs font-semibold text-indigo-500 hover:text-indigo-400">Forgot?</button>
            </div>
            <Input
              placeholder="••••••••"
              type="password"
              required
              autoComplete="current-password"
              value={this.password}
              onChange={(e) => this.onPasswordChange(e.target.value)}
              error={this.fieldErrors.password}
              inputClassName={LoginPageConstants.loginInputClassName}
            />
          </div>

          {this.requiresTwoFactor ? (
            <LoginTwoFactorFields
              twoFactorMethod={this.twoFactorMethod}
              totpToken={this.totpToken}
              recoveryCode={this.recoveryCode}
              fieldErrors={this.fieldErrors}
              onSelectMethod={this.onSelectTwoFactorMethod}
              onTotpTokenChange={this.onTotpTokenChange}
              onRecoveryCodeChange={this.onRecoveryCodeChange}
            />
          ) : null}

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-indigo-500/10 text-indigo-500">
                <FrameworkIcons.Shield size={14} />
              </div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Secure Session</span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full py-4 text-base transform hover:scale-[1.02] active:scale-[0.98]"
            isLoading={this.isLoading}
          >
            {this.requiresTwoFactor
              ? (this.twoFactorMethod === TwoFactorMethod.TOTP ? 'Verify 2FA & Sign In' : 'Use Recovery Code & Sign In')
              : 'Sign In to Portal'}
            {!this.isLoading && <FrameworkIcons.ArrowRight size={18} className="ml-2" />}
          </Button>
        </form>
      </div>
    );
  }
}
