import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './admin.css';
import ClientLayout from './client-layout';
import PwaRegister from './pwa-register';
import { AuthProvider } from '@/components/auth-context';
import { NotificationProvider } from '@/components/notification-context';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';

const ADMIN_FAVICON_PATH = AdminPathUtils.toAdminPath('/favicon.ico');
const ADMIN_APPLE_ICON_PATH = AdminPathUtils.toAdminPath(AppEnv.PWA_ICON_PATH);

export const metadata: Metadata = {
  title: `${AppEnv.APP_NAME} Admin`,
  description: `${AppEnv.APP_NAME} is the scalable application framework by ${AppEnv.COMPANY_NAME}.`,
  icons: {
    icon: ADMIN_FAVICON_PATH,
    shortcut: ADMIN_FAVICON_PATH,
    apple: ADMIN_APPLE_ICON_PATH,
  },
  // PWA: standalone iOS install + the web app manifest (Next serves app/manifest.ts at /manifest.webmanifest).
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: AppEnv.APP_NAME },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: AppEnv.PWA_THEME_COLOR,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body>
        <PwaRegister />
        <AuthProvider>
          <NotificationProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
