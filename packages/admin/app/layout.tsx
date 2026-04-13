import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './admin.css';
import ClientLayout from './client-layout';
import { AuthProvider } from '@/components/auth-context';
import { NotificationProvider } from '@/components/notification-context';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';

const ADMIN_FAVICON_PATH = AdminPathUtils.toAdminPath('/favicon.ico');
const ADMIN_APPLE_ICON_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-mark-indigo.png');

export const metadata: Metadata = {
  title: `${AppEnv.APP_NAME} Admin`,
  description: `${AppEnv.APP_NAME} is the scalable application framework by ${AppEnv.COMPANY_NAME}.`,
  icons: {
    icon: ADMIN_FAVICON_PATH,
    shortcut: ADMIN_FAVICON_PATH,
    apple: ADMIN_APPLE_ICON_PATH,
  },
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
