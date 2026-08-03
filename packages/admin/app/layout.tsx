import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import '@/app/admin.css';
import { ClientLayout } from '@/app/components/view/client-layout.client';
import { PwaRegister } from '@/app/components/view/pwa-register.client';
import { AuthProvider } from '@/components/view/auth-context.client';
import { NotificationProvider } from '@/components/view/notification-context.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';

/**
 * Admin root layout. Document metadata is rendered as real `<title>`/`<meta>`/`<link>` tags rather than
 * Next's `export const metadata`/`viewport` objects: React 19 hoists these into `<head>` natively, so the
 * module exports only this class.
 */
export class RootLayout extends Reactor {
  @prop declare children: ReactNode;

  private get faviconPath(): string {
    return AdminPathUtils.toAdminPath('/favicon.ico');
  }

  private get appleIconPath(): string {
    return AdminPathUtils.toAdminPath(AppEnv.PWA_ICON_PATH);
  }

  render(): ReactNode {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <title>{`${AppEnv.APP_NAME} Admin`}</title>
          <meta
            name="description"
            content={`${AppEnv.APP_NAME} is the scalable application framework by ${AppEnv.COMPANY_NAME}.`}
          />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="theme-color" content={AppEnv.PWA_THEME_COLOR} />
          <link rel="icon" href={this.faviconPath} />
          <link rel="shortcut icon" href={this.faviconPath} />
          <link rel="apple-touch-icon" href={this.appleIconPath} />
          {/* PWA: standalone iOS install + the web app manifest. */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content={AppEnv.APP_NAME} />
          <link rel="manifest" href={AdminPathUtils.toAdminPath('/manifest.webmanifest')} />
        </head>
        <body>
          <PwaRegister />
          <AuthProvider>
            <NotificationProvider>
              <ClientLayout>{this.children}</ClientLayout>
            </NotificationProvider>
          </AuthProvider>
        </body>
      </html>
    );
  }
}
