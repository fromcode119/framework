import type { FormEvent, ReactElement } from 'react';
import { state } from '@fromcode119/react-class-components';

import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { LoginShell } from '@/app/login/login-shell';
import { LoginPageHeader } from '@/app/login/login-page-header';
import { LoginField } from '@/app/login/login-field';
import { LoginSubmit } from '@/app/login/login-submit';
import { LoginNotice } from '@/app/login/login-notice';
import { LoginFieldType } from '@/app/login/enums/login-field-type.enum';
import { LoginNoticeTone } from '@/app/login/enums/login-notice-tone.enum';
import type { ILoginHelp } from '@/app/login/interfaces/login-help.interface';

export class ForgotPasswordPage extends AdminComponent {
  @state email = '';
  @state isLoading = false;
  @state error = '';
  @state message = '';

  private async handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    this.isLoading = true;
    this.error = '';
    this.message = '';
    try {
      const data = await AdminApi.post(
        `${AdminConstants.ENDPOINTS.AUTH.FORGOT_PASSWORD}?context=admin`,
        { email: this.email, context: 'admin' },
        { headers: { 'X-Reset-Context': 'admin' } }
      );
      this.message = data?.message || AdminI18n.t('login.forgot.sent');
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('login.forgot.failed');
    } finally {
      this.isLoading = false;
    }
  }

  private get help(): ILoginHelp {
    const items = ['item1', 'item2', 'item3'].map((key) => AdminI18n.optional(`login.help.forgot.${key}`)).filter(Boolean) as string[];
    return { title: AdminI18n.t('login.help.forgot.title'), items };
  }

  render(): ReactElement {
    return (
      <LoginShell help={this.help}>
        <LoginPageHeader title={AdminI18n.t('login.forgot.title')} subtitle={AdminI18n.t('login.forgot.subtitle')} />
        <form onSubmit={(event) => this.handleSubmit(event)} className="fc-login__form" noValidate>
          <LoginNotice message={this.error} tone={LoginNoticeTone.ERROR} />
          <LoginNotice message={this.message} tone={LoginNoticeTone.OK} />
          <LoginField id="fc-forgot-email" label={AdminI18n.t('login.email')} type={LoginFieldType.EMAIL} autoComplete="username" autoFocus value={this.email} onChange={(value) => { this.email = value; }} />
          <LoginSubmit label={AdminI18n.t('login.forgot.send')} isLoading={this.isLoading} />
          <div className="fc-login__links">
            <button type="button" className="fc-login__link" onClick={() => this.router.push(AdminConstants.ROUTES.AUTH.LOGIN)}>{AdminI18n.t('login.backToLogin')}</button>
          </div>
        </form>
      </LoginShell>
    );
  }
}
