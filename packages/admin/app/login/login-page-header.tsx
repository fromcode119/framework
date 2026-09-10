import type { ReactNode } from 'react';
import { Reactor, state } from '@fromcode119/react-class-components';

import { AppEnv } from '@/lib/env';
import { LoginPageConstants } from '@/app/login/constants/login-page.constants';
import { HostInfoClient } from '@/lib/tenants/host-info-client';
import { AdminPageKeys } from '@/lib/appearance/admin-page-keys';
import { AdminPageRegistry } from '@/lib/appearance/admin-page-registry';

/**
 * On a WORKSPACE domain the login says whose console it is (the tenant, its appearance) instead of
 * the platform's welcome — the domain already belongs to that customer (T6).
 */
export class LoginPageHeader extends Reactor {
  @state workspace: { slug: string; appearance: string } | null = null;

  componentDidMount(): void {
    void HostInfoClient.workspace().then((workspace) => { this.workspace = workspace; });
  }

  private get title(): string {
    return this.workspace ? `Sign in to ${this.workspace.slug}` : `Welcome to ${AppEnv.APP_NAME}`;
  }

  /**
   * The PLATFORM wordmark, shown unless the active appearance brought its own sign-in frame.
   *
   * On a workspace domain that frame carries the customer's logo, and printing Atlantis above it made
   * the page read as two products stacked — which is what "the real login still hasn't changed" meant:
   * the words said the workspace, the mark still said the platform. When no appearance claims the
   * sign-in, this is the only brand on the page and stays exactly as it was.
   */
  private get showsPlatformBrand(): boolean {
    const appearance = this.workspace?.appearance || '';
    if (!appearance) return true;
    return !AdminPageRegistry.shared.resolve(appearance, AdminPageKeys.LOGIN_FRAME);
  }

  private get subtitle(): string {
    if (this.workspace) return `${this.workspace.slug} runs the ${this.workspace.appearance || 'default'} console on this domain.`;
    return `Sign in to manage your ${AppEnv.APP_NAME} workspace powered by ${AppEnv.COMPANY_NAME}.`;
  }

  render(): ReactNode {
    return (
      <div className="fc-login__header text-center mb-10">
        {this.showsPlatformBrand ? (
          <div className="mb-6 inline-flex items-center justify-center px-5 py-4 ">
            <img
              src={LoginPageConstants.BRAND_LOGO_LIGHT_PATH}
              alt={`${AppEnv.APP_NAME} by ${AppEnv.COMPANY_NAME} logo`}
              className="h-auto w-[220px] dark:hidden"
            />
            <img
              src={LoginPageConstants.BRAND_LOGO_DARK_PATH}
              alt={`${AppEnv.APP_NAME} by ${AppEnv.COMPANY_NAME} logo`}
              className="hidden h-auto w-[220px] dark:block"
            />
          </div>
        ) : null}
        <h1 className="fc-login__title text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
          {this.title}
        </h1>
        <p className="fc-login__subtitle font-medium text-slate-500 dark:text-slate-300">
          {this.subtitle}
        </p>
      </div>
    );
  }
}
