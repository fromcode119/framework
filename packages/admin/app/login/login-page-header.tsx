import React from 'react';
import { AppEnv } from '@/lib/env';
import { LoginPageConstants } from './login-page.constants';

export class LoginPageHeader extends React.Component {
  render(): React.ReactNode {
    return (
      <div className="text-center mb-10">
        <div className="mb-6 inline-flex items-center justify-center px-5 py-4 ">
          <img
            src={LoginPageConstants.ATLANTIS_LOGO_SLATE_PATH}
            alt={`${AppEnv.APP_NAME} by ${AppEnv.COMPANY_NAME} logo`}
            className="h-auto w-[220px] dark:hidden"
          />
          <img
            src={LoginPageConstants.ATLANTIS_LOGO_WHITE_PATH}
            alt={`${AppEnv.APP_NAME} by ${AppEnv.COMPANY_NAME} logo`}
            className="hidden h-auto w-[220px] dark:block"
          />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
          Welcome to {AppEnv.APP_NAME}
        </h1>
        <p className="font-medium text-slate-500 dark:text-slate-300">
          Sign in to manage your {AppEnv.APP_NAME} workspace powered by {AppEnv.COMPANY_NAME}.
        </p>
      </div>
    );
  }
}
