import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './admin.css';
import ClientLayout from './client-layout';
import { AuthProvider } from '../components/auth-context';
import { NotificationProvider } from '../components/notification-context';
import { FrameworkIcons } from '../lib/icons';

export const metadata: Metadata = {
  title: 'Fromcode Admin',
  description: 'Management Interface',
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
