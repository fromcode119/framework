import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './admin.css';
import ClientLayout from './ClientLayout';
import { AuthProvider } from '@/components/AuthContext';
import { NotificationProvider } from '@/components/NotificationContext';

export const metadata: Metadata = {
  title: 'Fromcode Admin',
  description: 'Management Interface',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const version = Date.now(); // Cache buster for the dynamic module
  
  const importMap = {
    imports: {
      "react": "data:text/javascript,export default window.React; export const { useState, useEffect, useContext, useReducer, useCallback, useMemo, useRef, useImperativeHandle, useLayoutEffect, useInsertionEffect, useDebugValue, useDeferredValue, useTransition, useId, useSyncExternalStore, createElement, Fragment, createContext } = window.React;",
      "react/jsx-runtime": "data:text/javascript,export const Fragment = window.React.Fragment; export const jsx = (type, props, key) => window.React.createElement(type, { ...props, key }); export const jsxs = (type, { children, ...props }, key) => window.React.createElement(type, { ...props, key }, ...(Array.isArray(children) ? children : [children]));",
      "react-dom": "data:text/javascript,export default window.ReactDOM; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal } = window.ReactDOM;",
      "lucide-react": `/icons-registry?v=${version}`
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="fc-importmap"
          type="importmap"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(importMap)
          }}
        />
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
