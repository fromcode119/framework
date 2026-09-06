import type { ReactNode } from 'react';
import { Reactor, state } from '@fromcode119/reactor';

import { AppEnv } from '@/lib/env';
import { LoginPageConstants } from '@/app/login/constants/login-page.constants';
import { HostInfoClient } from '@/lib/tenants/host-info-client';

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

  private get subtitle(): string {
    if (this.workspace) return `${this.workspace.slug} runs the ${this.workspace.appearance || 'default'} console on this domain.`;
    return `Sign in to manage your ${AppEnv.APP_NAME} workspace powered by ${AppEnv.COMPANY_NAME}.`;
  }

  render(): ReactNode {
    return (
      <div className="text-center mb-10">
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
        <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
          {this.title}
        </h1>
        <p className="font-medium text-slate-500 dark:text-slate-300">
          {this.subtitle}
        </p>
      </div>
    );
  }
}
