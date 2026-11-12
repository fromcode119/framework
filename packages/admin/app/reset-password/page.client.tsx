import type { FormEvent, ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminLink } from '@/components/view/admin-link.client';
import { LoginShell } from '@/app/login/login-shell';
import { LoginPageHeader } from '@/app/login/login-page-header';
import { LoginField } from '@/app/login/login-field';
import { LoginSubmit } from '@/app/login/login-submit';
import { LoginNotice } from '@/app/login/login-notice';
import { LoginFieldType } from '@/app/login/enums/login-field-type.enum';
import { LoginNoticeTone } from '@/app/login/enums/login-notice-tone.enum';
import type { ILoginHelp } from '@/app/login/interfaces/login-help.interface';

export class ResetPasswordPage extends AdminComponent {
  @state token = '';
  @state newPassword = '';
  @state confirmPassword = '';
  @state isLoading = false;
  @state error = '';
  @state message = '';

  componentDidMount(): void {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get('token') || '').trim();
    if (fromUrl) this.token = fromUrl;
  }

  private async handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    this.isLoading = true;
    this.error = '';
    this.message = '';

    const token = this.token;
    const newPassword = this.newPassword;
    const confirmPassword = this.confirmPassword;

    if (!token) {
      this.error = AdminI18n.t('login.reset.tokenRequired');
      this.isLoading = false;
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      this.error = AdminI18n.t('login.reset.tooShort');
      this.isLoading = false;
      return;
    }
    if (newPassword !== confirmPassword) {
      this.error = AdminI18n.t('login.reset.mismatch');
      this.isLoading = false;
      return;
    }

    try {
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.RESET_PASSWORD, { token, newPassword });
      this.message = data?.message || AdminI18n.t('login.reset.done');
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('login.reset.failed');
    } finally {
      this.isLoading = false;
    }
  }

  private get help(): ILoginHelp {
    const items = ['item1', 'item2', 'item3'].map((key) => AdminI18n.optional(`login.help.reset.${key}`)).filter(Boolean) as string[];
    return { title: AdminI18n.t('login.help.reset.title'), items };
  }

  render(): ReactElement {
    return (
      <LoginShell help={this.help}>
        <LoginPageHeader title={AdminI18n.t('login.reset.title')} subtitle={AdminI18n.t('login.reset.subtitle')} />
        <form onSubmit={(event) => this.handleSubmit(event)} className="fc-login__form" noValidate>
          <LoginNotice message={this.error} tone={LoginNoticeTone.ERROR} />
          <LoginNotice message={this.message} tone={LoginNoticeTone.OK} />
          <LoginField id="fc-reset-token" label={AdminI18n.t('login.reset.token')} type={LoginFieldType.TEXT} autoComplete="one-time-code" value={this.token} onChange={(value) => { this.token = value.trim(); }} />
          <LoginField id="fc-reset-new" label={AdminI18n.t('login.reset.newPassword')} type={LoginFieldType.PASSWORD} autoComplete="new-password" value={this.newPassword} onChange={(value) => { this.newPassword = value; }} />
          <LoginField id="fc-reset-confirm" label={AdminI18n.t('login.reset.confirmPassword')} type={LoginFieldType.PASSWORD} autoComplete="new-password" value={this.confirmPassword} onChange={(value) => { this.confirmPassword = value; }} />
          <LoginSubmit label={AdminI18n.t('login.reset.submit')} isLoading={this.isLoading} />
          <div className="fc-login__links">
            <button type="button" className="fc-login__link" onClick={() => this.router.push(AdminConstants.ROUTES.AUTH.LOGIN)}>{AdminI18n.t('login.backToLogin')}</button>
            <AdminLink href={AdminConstants.ROUTES.AUTH.FORGOT_PASSWORD} className="fc-login__link">{AdminI18n.t('login.reset.needLink')}</AdminLink>
          </div>
        </form>
      </LoginShell>
    );
  }
}
