import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import '@/app/admin.css';
import { ClientLayout } from '@/app/components/view/client-layout.client';
import { PwaRegister } from '@/app/components/view/pwa-register.client';
import { AuthProvider } from '@/components/view/auth-context.client';
import { NotificationProvider } from '@/components/view/notification-context.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import { ApplicationUrlUtils } from '@fromcode119/core/utils/application-url-utils';
import { RuntimeLocationUtils } from '@fromcode119/core/utils/runtime-location-utils';
import { ConsoleMountConstants } from '@fromcode119/core/constants/console-mount.constants';
import { ConsoleMountUtils } from '@fromcode119/core/utils/console-mount-utils';
import { ConsoleMountProvider } from '@/components/view/console-mount-provider.client';

/**
 * Admin root layout. Document metadata is rendered as real `<title>`/`<meta>`/`<link>` tags rather than
 * Next's `export const metadata`/`viewport` objects: React 19 hoists these into `<head>` natively, so the
 * module exports only this class.
 *
 * Every admin page renders PER REQUEST (`connection()`): each carries a fresh script nonce for its
 * Content-Security-Policy (`AdminContentSecurityPolicy`), which a page prerendered at build time could
 * not — its scripts would carry none and the policy would refuse all of them.
 *
 * `<html>` names the console as the app that rendered it, so storefront code a plugin bundle carries
 * (a tracker, a vendor tag) knows it is in the console on ANY host — not only an `admin.` one.
 *
 * On a console mounted at a site's console path the gateway names the mount in a request header
 * (`ConsoleMountConstants`). The document carries it on `<html>` for code outside React, and
 * `ConsoleMountProvider` publishes it to everything rendered below — the server render included.
 */
export class RootLayout {
  static async render({ children }: Readonly<{ children: ReactNode }>): Promise<ReactNode> {
    await connection();
    const mount = ConsoleMountUtils.sanitize((await headers()).get(ConsoleMountConstants.HEADER));
    const faviconPath = AdminPathUtils.toBrowserPath('/favicon.ico', mount);
    const documentAttributes = {
      [RuntimeLocationUtils.RUNTIME_ATTRIBUTE]: ApplicationUrlUtils.ADMIN_APP,
      ...(mount ? { [ConsoleMountConstants.ATTRIBUTE]: mount } : {}),
    };
    return (
      <html lang="en" suppressHydrationWarning {...documentAttributes}>
        <head>
          <title>{`${AppEnv.APP_NAME} Admin`}</title>
          <meta
            name="description"
            content={`${AppEnv.APP_NAME} is the scalable application framework by ${AppEnv.COMPANY_NAME}.`}
          />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="theme-color" content={AppEnv.PWA_THEME_COLOR} />
          <link rel="icon" href={faviconPath} />
          <link rel="shortcut icon" href={faviconPath} />
          <link rel="apple-touch-icon" href={AdminPathUtils.toBrowserPath(AppEnv.PWA_ICON_PATH, mount)} />
          {/* PWA: standalone iOS install + the web app manifest.
              `mobile-web-app-capable` is the standard tag; `apple-mobile-web-app-capable` is the
              legacy iOS-only spelling that Chrome now logs a deprecation warning for. Both are kept:
              older iOS Safari still reads only the apple- prefixed one. */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content={AppEnv.APP_NAME} />
          <link rel="manifest" href={AdminPathUtils.toBrowserPath('/manifest.webmanifest', mount)} />
        </head>
        <body>
          <ConsoleMountProvider mount={mount}>
            <PwaRegister />
            <AuthProvider>
              <NotificationProvider>
                <ClientLayout>{children}</ClientLayout>
              </NotificationProvider>
            </AuthProvider>
          </ConsoleMountProvider>
        </body>
      </html>
    );
  }
}
