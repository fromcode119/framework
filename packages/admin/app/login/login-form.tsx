import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@fromcode119/react';
import { LoginTwoFactorFields } from './login-two-factor-fields';
import { LoginPageConstants } from './login-page.constants';
import type { LoginFormProps } from './login-form.interfaces';

export class LoginForm extends React.Component<LoginFormProps> {
  render(): React.ReactNode {
    const props = this.props;
    const {
      email,
      password,
      totpToken,
      recoveryCode,
      twoFactorMethod,
      requiresTwoFactor,
      isLoading,
      error,
      fieldErrors,
    } = props;

    return (
      <div className="p-8 rounded-3xl border shadow-2xl bg-white border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 dark:shadow-black/40">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-semibold animate-in fade-in zoom-in duration-300">
            {error}
          </div>
        )}
        <form onSubmit={props.onSubmit} className="space-y-6" noValidate>
          <Input
            label="Email Address"
            placeholder="name@company.com"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => props.onEmailChange(e.target.value)}
            error={fieldErrors.email}
            className="group"
            inputClassName={LoginPageConstants.loginInputClassName}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Password</label>
              <button type="button" onClick={props.onForgotPassword} className="text-xs font-semibold text-indigo-500 hover:text-indigo-400">Forgot?</button>
            </div>
            <Input
              placeholder="••••••••"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => props.onPasswordChange(e.target.value)}
              error={fieldErrors.password}
              inputClassName={LoginPageConstants.loginInputClassName}
            />
          </div>

          {requiresTwoFactor ? (
            <LoginTwoFactorFields
              twoFactorMethod={twoFactorMethod}
              totpToken={totpToken}
              recoveryCode={recoveryCode}
              fieldErrors={fieldErrors}
              onSelectMethod={props.onSelectTwoFactorMethod}
              onTotpTokenChange={props.onTotpTokenChange}
              onRecoveryCodeChange={props.onRecoveryCodeChange}
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
            isLoading={isLoading}
          >
            {requiresTwoFactor
              ? (twoFactorMethod === 'totp' ? 'Verify 2FA & Sign In' : 'Use Recovery Code & Sign In')
              : 'Sign In to Portal'}
            {!isLoading && <FrameworkIcons.ArrowRight size={18} className="ml-2" />}
          </Button>
        </form>
      </div>
    );
  }
}
