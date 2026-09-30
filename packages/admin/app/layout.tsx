import type { ReactNode } from 'react';
import { connection } from 'next/server';
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
 *
 * Every admin page renders PER REQUEST (`connection()`): each carries a fresh script nonce for its
 * Content-Security-Policy (`AdminContentSecurityPolicy`), which a page prerendered at build time could
 * not — its scripts would carry none and the policy would refuse all of them.
 */
export class RootLayout {
  private static get faviconPath(): string {
    return AdminPathUtils.toAdminPath('/favicon.ico');
  }

  private static get appleIconPath(): string {
    return AdminPathUtils.toAdminPath(AppEnv.PWA_ICON_PATH);
  }

  static async render({ children }: Readonly<{ children: ReactNode }>): Promise<ReactNode> {
    await connection();
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
          <link rel="icon" href={RootLayout.faviconPath} />
          <link rel="shortcut icon" href={RootLayout.faviconPath} />
          <link rel="apple-touch-icon" href={RootLayout.appleIconPath} />
          {/* PWA: standalone iOS install + the web app manifest.
              `mobile-web-app-capable` is the standard tag; `apple-mobile-web-app-capable` is the
              legacy iOS-only spelling that Chrome now logs a deprecation warning for. Both are kept:
              older iOS Safari still reads only the apple- prefixed one. */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content={AppEnv.APP_NAME} />
          <link rel="manifest" href={AdminPathUtils.toAdminPath('/manifest.webmanifest')} />
        </head>
        <body>
          <PwaRegister />
          <AuthProvider>
            <NotificationProvider>
              <ClientLayout>{children}</ClientLayout>
            </NotificationProvider>
          </AuthProvider>
        </body>
      </html>
    );
  }
}
