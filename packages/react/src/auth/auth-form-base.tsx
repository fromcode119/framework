import type { ReactNode } from 'react';
import { Platform } from '@fromcode119/react-class-components';
import { SdkClient, BrowserStateClient, RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';

/**
 * Shared base for the framework-default auth forms (login / register / forgot / reset). Owns the
 * framework session mechanism (`SystemAuthClient` for the calls, `SystemAuthSession` for storing the
 * token+user) resolved from the plugin runtime api — the SAME path AccountAuthGate uses — plus the
 * neutral, theme-agnostic markup so every form looks presentable standalone. Styling lives in semantic
 * `fc-auth*` CSS classes shipped as a framework frontend global stylesheet (`app/auth.css`); a branded
 * theme rebrands purely by overriding those classes and never touches this — this is the zero-config default.
 */
export abstract class AuthFormBase<P = Record<string, unknown>, S = Record<string, unknown>>
  extends PluginComponent<P, S> {
  protected readonly browserState = new BrowserStateClient();

  /** Framework auth calls: login / register / forgotPassword / resetPassword / resendVerification. */
  protected get systemAuth(): any {
    return new SdkClient(this.api).getSystemAuth();
  }

  /** Framework session store: `storeSession(token, user)` — writes the auth cookie + cached user. */
  protected get session(): any {
    return new SdkClient(this.api).getSystemAuthSession();
  }

  /** Translate with an English default so the framework renders complete even with no locale pack. */
  protected tr(key: string, fallback: string, params?: Record<string, any>): string {
    return this.t(key, params, fallback);
  }

  /** Best-effort human-readable message from a thrown api-client error. */
  protected errorMessage(error: any, fallback: string): string {
    return String(
      error?.response?.data?.error
        || error?.data?.error
        || error?.body?.error
        || error?.message
        || fallback,
    );
  }

  /**
   * Where a sign-in continues: a same-site `?next=` path, else the framework account page. `//host` and
   * `/\\host` also start with a slash but are protocol-relative addresses a browser follows off-site, so a
   * crafted sign-in link could hand a freshly signed-in visitor to any site.
   */
  protected get afterAuthPath(): string {
    const next = Platform.isBrowser ? this.browserState.readQueryParamFromWindow('next') : '';
    const local = Boolean(next) && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
    return local ? next : RouteConstants.SEGMENTS.ACCOUNT;
  }

  /** After a successful sign-in, go to {@link afterAuthPath}. */
  protected navigateAfterAuth(): void {
    if (!Platform.isBrowser) return;
    window.location.assign(this.afterAuthPath);
  }

  /** Neutral labelled text/password/email field used by every form. */
  protected renderField(
    label: string,
    type: string,
    value: string,
    onChange: (value: string) => void,
    options: { autoComplete?: string; placeholder?: string; name?: string } = {},
  ): ReactNode {
    return (
      <label className="fc-auth__field">
        <span className="fc-auth__label">{label}</span>
        <input
          type={type}
          name={options.name}
          value={value}
          autoComplete={options.autoComplete}
          placeholder={options.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="fc-auth__input"
        />
      </label>
    );
  }
}
