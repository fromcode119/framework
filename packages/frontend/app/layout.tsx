import type { Metadata } from "next";
import GlobalInitializer from "./GlobalInitializer";
import RootProvider from "./RootProvider";

export const metadata: Metadata = {
  title: "Fromcode Frontend",
  description: "Next.js 15 App Router Frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = Date.now();

  const importMap = {
    imports: {
      "react": "data:text/javascript,export default window.React; export const { useState, useEffect, useContext, useReducer, useCallback, useMemo, useRef, useImperativeHandle, useLayoutEffect, useInsertionEffect, useDebugValue, useDeferredValue, useTransition, useId, useSyncExternalStore, createElement, Fragment, createContext } = window.React;",
      "react/jsx-runtime": "data:text/javascript,export const Fragment = window.React.Fragment; export const jsx = (type, props, key) => window.React.createElement(type, { ...props, key }); export const jsxs = (type, { children, ...props }, key) => window.React.createElement(type, { ...props, key }, ...(Array.isArray(children) ? children : [children]));",
      "react-dom": "data:text/javascript,export default window.ReactDOM; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal } = window.ReactDOM;",
      "lucide-react": "/icons-registry?v=" + version
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
        <GlobalInitializer />
        <RootProvider>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

