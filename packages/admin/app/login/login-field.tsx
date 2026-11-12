import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { LoginFieldType } from '@/app/login/enums/login-field-type.enum';

/**
 * One labelled input of a signed-out screen. A password field gets a show/hide button inside it, and
 * `aside` puts a link at the end of the label row ("Forgot password?"). No placeholder: the label says
 * what goes in, and a placeholder of dots or a made-up address only looks like a value.
 */
export class LoginField extends Reactor {
  declare props: Pick<LoginField, 'id' | 'label' | 'type' | 'value' | 'onChange' | 'autoComplete' | 'error' | 'aside' | 'autoFocus'>;

  @prop declare id: string;
  @prop declare label: string;
  @prop declare type: LoginFieldType;
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare autoComplete: string;
  @prop declare error?: string;
  @prop declare aside?: ReactNode;
  @prop declare autoFocus?: boolean;

  private static readonly EyeOffIcon = FrameworkIcons.createProxyIcon('EyeOff');

  @state revealed = false;

  render(): ReactNode {
    const isPassword = this.type === LoginFieldType.PASSWORD;
    const errorId = `${this.id}-error`;
    return (
      <div className="fc-login__field">
        <div className="fc-login__label-row">
          <label className="fc-login__label" htmlFor={this.id}>{this.label}</label>
          {this.aside}
        </div>
        <div className="fc-login__control">
          <input
            id={this.id}
            className={`fc-login__input${isPassword ? ' fc-login__input--with-action' : ''}`}
            type={isPassword && this.revealed ? LoginFieldType.TEXT.value : this.type.value}
            value={this.value}
            onChange={(event) => this.onChange(event.target.value)}
            autoComplete={this.autoComplete}
            autoFocus={this.autoFocus}
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={this.error ? true : undefined}
            aria-describedby={this.error ? errorId : undefined}
          />
          {isPassword ? (
            <button
              type="button"
              className="fc-login__reveal"
              aria-label={AdminI18n.t(this.revealed ? 'login.hidePassword' : 'login.showPassword')}
              aria-pressed={this.revealed}
              onClick={() => { this.revealed = !this.revealed; }}
            >
              {this.revealed ? <LoginField.EyeOffIcon size={18} /> : <FrameworkIcons.Eye size={18} />}
            </button>
          ) : null}
        </div>
        {this.error ? <span id={errorId} className="fc-login__field-error">{this.error}</span> : null}
      </div>
    );
  }
}
