import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './admin.css';
import ClientLayout from './client-layout';
import { AuthProvider } from '@/components/auth-context';
import { NotificationProvider } from '@/components/notification-context';
import { AppEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: `${AppEnv.APP_NAME} Admin`,
  description: `${AppEnv.APP_NAME} is the scalable application framework by ${AppEnv.COMPANY_NAME}.`,
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/brand/atlantis-mark-indigo.png',
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
