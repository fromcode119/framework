import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';

import { Select } from '@/components/ui/view/select.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { LoginWaves } from '@/app/login/login-waves';
import type { ILoginHelp } from '@/app/login/interfaces/login-help.interface';

/**
 * The frame every signed-out screen shares — sign-in, two-step code, forgot and reset password: the
 * card, its toolbar (name, help toggle, language, light/dark) and the help column beside the form.
 *
 * The help column says what is useful at THIS step (`help`), over the animated ribbons. A visitor may
 * close it; the choice is remembered in this browser only, and the toggle sits on the toolbar so it can
 * be reopened. On a phone the column is never shown — there is no room beside the form — and the toggle
 * goes with it.
 */
export class LoginShell extends AdminComponent {
  declare props: Pick<LoginShell, 'help' | 'children'>;

  @prop declare help: ILoginHelp;
  @prop declare children: ReactNode;

  private static readonly HELP_HIDDEN_KEY = 'fc_login_help_hidden';
  private static readonly PanelIcon = FrameworkIcons.createProxyIcon('PanelRight');

  @state helpHidden = false;

  componentDidMount(): void {
    try {
      this.helpHidden = window.localStorage.getItem(LoginShell.HELP_HIDDEN_KEY) === '1';
    } catch {
      // Storage blocked: the column simply starts open.
    }
  }

  private setHelpHidden(hidden: boolean): void {
    this.helpHidden = hidden;
    try {
      window.localStorage.setItem(LoginShell.HELP_HIDDEN_KEY, hidden ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts until the page is left.
    }
  }

  private renderToolbar(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const brandAlt = AdminI18n.t('login.logoAlt', { app: AppEnv.APP_NAME, company: AppEnv.COMPANY_NAME });
    return (
      <div className="fc-login__toolbar">
        <span className="fc-login__brand">
          <img className="fc-login__wordmark fc-login__wordmark--light" src={AdminPathUtils.toBrowserPath(AppEnv.BRAND_WORDMARK_LIGHT_PATH)} alt={brandAlt} />
          <img className="fc-login__wordmark fc-login__wordmark--dark" src={AdminPathUtils.toBrowserPath(AppEnv.BRAND_WORDMARK_DARK_PATH)} alt={brandAlt} />
        </span>
        <div className="fc-login__tools">
          {this.helpHidden ? (
            <button type="button" className="fc-login__tool fc-login__tool--icon fc-login__help-open" title={AdminI18n.t('login.help.show')} aria-label={AdminI18n.t('login.help.show')} onClick={() => this.setHelpHidden(false)}>
              <LoginShell.PanelIcon size={16} />
            </button>
          ) : null}
          <Select
            className="w-44"
            value={AdminI18n.locale}
            onChange={(locale) => AdminI18n.setLocale(locale)}
            options={AdminDictionary.locales.map((locale) => ({ label: AdminDictionary.label(locale), value: locale }))}
            searchable={false}
            theme={dark ? ThemeMode.DARK : ThemeMode.LIGHT}
          />
          <button type="button" className="fc-login__tool fc-login__tool--icon" title={AdminI18n.t(dark ? 'login.themeLight' : 'login.themeDark')} aria-label={AdminI18n.t(dark ? 'login.themeLight' : 'login.themeDark')} onClick={() => this.runtime.toggleTheme()}>
            {dark ? <FrameworkIcons.Sun size={16} /> : <FrameworkIcons.Moon size={16} />}
          </button>
        </div>
      </div>
    );
  }

  private renderHelp(): ReactNode {
    const help = this.help;
    return (
      <aside className="fc-login__side" aria-label={help.title}>
        <LoginWaves />
        <button type="button" className="fc-login__tool fc-login__tool--icon fc-login__help-close" title={AdminI18n.t('login.help.hide')} aria-label={AdminI18n.t('login.help.hide')} onClick={() => this.setHelpHidden(true)}>
          <LoginShell.PanelIcon size={16} />
        </button>
        <div className="fc-login__help">
          <h2 className="fc-login__help-title">{help.title}</h2>
          {help.text ? <p className="fc-login__help-text">{help.text}</p> : null}
          {help.items?.length ? (
            <ul className="fc-login__help-list">
              {help.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </div>
      </aside>
    );
  }

  render(): ReactNode {
    return (
      <div className={`fc-login${this.theme === ThemeMode.DARK ? ' is-dark' : ''}${this.helpHidden ? ' is-solo' : ''}`}>
        <div className="fc-login__panel">
          <div className="fc-login__main">
            {this.renderToolbar()}
            {this.children}
          </div>
          {this.helpHidden ? null : this.renderHelp()}
        </div>
      </div>
    );
  }
}
