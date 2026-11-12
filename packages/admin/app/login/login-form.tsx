import { TwoFactorMethod } from '@fromcode119/core/client';
import type { FormEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

import { LoginField } from '@/app/login/login-field';
import { LoginNotice } from '@/app/login/login-notice';
import { LoginFieldType } from '@/app/login/enums/login-field-type.enum';
import { LoginNoticeTone } from '@/app/login/enums/login-notice-tone.enum';
import { LoginOtpInput } from '@/app/login/login-otp-input';
import { LoginSubmit } from '@/app/login/login-submit';
import type { ILoginFieldErrors } from '@/app/login/interfaces/login-field-errors.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The sign-in form, in its two steps. First the email and password; when the account has two-step
 * sign-in, the SAME form then asks only for the code — six boxes for the authenticator, or one field for
 * a backup code — with a way back to the first step. The email and password stay with the page and are
 * sent again with the code, which is what `/auth/login` expects.
 *
 * Every element keeps a stable `fc-login__*` class: an appearance's stylesheet restyles the form
 * through those, while the fields and the submit stay the framework's.
 */
export class LoginForm extends PureReactor {
  declare props: Pick<LoginForm, 'email' | 'password' | 'totpToken' | 'recoveryCode' | 'twoFactorMethod' | 'requiresTwoFactor' | 'isLoading' | 'error' | 'fieldErrors' | 'onSubmit' | 'onEmailChange' | 'onPasswordChange' | 'onForgotPassword' | 'onSelectTwoFactorMethod' | 'onTotpTokenChange' | 'onRecoveryCodeChange' | 'onBackToPassword'>;

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
  @prop declare onForgotPassword: () => void;
  @prop declare onSelectTwoFactorMethod: (method: TwoFactorMethod) => void;
  @prop declare onTotpTokenChange: (value: string) => void;
  @prop declare onRecoveryCodeChange: (value: string) => void;
  @prop declare onBackToPassword: () => void;

  private renderCredentials(): ReactNode {
    return (
      <>
        <LoginField
          id="fc-login-email"
          label={AdminI18n.t('login.email')}
          type={LoginFieldType.EMAIL}
          autoComplete="username"
          autoFocus
          value={this.email}
          onChange={this.onEmailChange}
          error={this.fieldErrors.email}
        />
        <LoginField
          id="fc-login-password"
          label={AdminI18n.t('login.password')}
          type={LoginFieldType.PASSWORD}
          autoComplete="current-password"
          value={this.password}
          onChange={this.onPasswordChange}
          error={this.fieldErrors.password}
          aside={<button type="button" className="fc-login__link fc-login__forgot" onClick={this.onForgotPassword}>{AdminI18n.t('login.forgotShort')}</button>}
        />
        <LoginSubmit label={AdminI18n.t('login.signIn')} isLoading={this.isLoading} />
      </>
    );
  }

  private renderTwoFactor(): ReactNode {
    const totp = this.twoFactorMethod === TwoFactorMethod.TOTP;
    return (
      <>
        {totp ? (
          <>
            <LoginOtpInput label={AdminI18n.t('login.twoFactorCode')} value={this.totpToken} onChange={this.onTotpTokenChange} invalid={Boolean(this.fieldErrors.totpToken)} />
            {this.fieldErrors.totpToken ? <span className="fc-login__field-error">{this.fieldErrors.totpToken}</span> : null}
          </>
        ) : (
          <LoginField
            id="fc-login-recovery"
            label={AdminI18n.t('login.recoveryCode')}
            type={LoginFieldType.TEXT}
            autoComplete="off"
            autoFocus
            value={this.recoveryCode}
            onChange={(value) => this.onRecoveryCodeChange(value.toUpperCase())}
            error={this.fieldErrors.recoveryCode}
          />
        )}
        <LoginSubmit label={AdminI18n.t(totp ? 'login.verifyTotp' : 'login.useRecovery')} isLoading={this.isLoading} />
        <div className="fc-login__links">
          <button type="button" className="fc-login__link" onClick={() => this.onSelectTwoFactorMethod(totp ? TwoFactorMethod.RECOVERY : TwoFactorMethod.TOTP)}>
            {AdminI18n.t(totp ? 'login.twoFactor.useRecovery' : 'login.twoFactor.useAuthenticator')}
          </button>
          <button type="button" className="fc-login__link" onClick={this.onBackToPassword}>{AdminI18n.t('login.backToLogin')}</button>
        </div>
      </>
    );
  }

  render(): ReactNode {
    return (
      <form onSubmit={this.onSubmit} className="fc-login__form" noValidate>
        <LoginNotice message={this.error} tone={LoginNoticeTone.ERROR} />
        {this.requiresTwoFactor ? this.renderTwoFactor() : this.renderCredentials()}
      </form>
    );
  }
}
