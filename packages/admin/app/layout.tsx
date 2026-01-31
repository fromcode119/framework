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
      "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useContext, useReducer, useCallback, useMemo, useRef, useImperativeHandle, useLayoutEffect, useInsertionEffect, useDebugValue, useDeferredValue, useTransition, useId, useSyncExternalStore, createElement, Fragment, createContext, version, forwardRef } = window.React;",
      "react/jsx-runtime": "data:application/javascript,export const Fragment = window.React.Fragment; export const jsx = (type, props, key) => window.React.createElement(type, { ...props, key }); export const jsxs = (type, { children, ...props }, key) => window.React.createElement(type, { ...props, key }, ...(Array.isArray(children) ? children : [children]));",
      "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const render = (...args) => rd.render(...args); export const hydrate = (...args) => rd.hydrate(...args); export const createPortal = (...args) => rd.createPortal(...args); export const createRoot = (...args) => rd.createRoot(...args);",
      "lucide-react": "data:application/javascript,const p=(n)=>(r)=>{const C=(window.FrameworkIcons&&window.FrameworkIcons[n])||(window.Fromcode&&window.Fromcode[n])||(window.Lucide&&window.Lucide[n]);return C?window.React.createElement(C,r):null;};export const Loader2=p('Loader2');export const Loader=Loader2;export const Search=p('Search');export const Plus=p('Plus');export const Trash2=p('Trash2');export const Pencil=p('Pencil');export const Save=p('Save');export const Download=p('Download');export const Upload=p('Upload');export const RefreshCw=p('RefreshCw');export const ExternalLink=p('ExternalLink');export const MoreHorizontal=p('MoreHorizontal');export const Filter=p('Filter');export const FileText=p('FileText');export const Tag=p('Tag');export const Layers=p('Layers');export const ChevronDown=p('ChevronDown');export const ChevronUp=p('ChevronUp');export const X=p('X');export const Image=p('Image');export const File=p('File');export const Film=p('Film');export const Play=p('Play');export const ChevronRight=p('ChevronRight');export const Home=p('Home');export const Info=p('Info');export const AlertCircle=p('AlertCircle');export const CheckCircle2=p('CheckCircle2');export const MoreVertical=p('MoreVertical');export const Layout=p('Layout');export const Columns=p('Columns');export const Copy=p('Copy');export const Settings=p('Settings');export const BarChart3=p('BarChart3');export const PlusCircle=p('PlusCircle');export const Trash=p('Trash');export const Edit=p('Edit');export const Zap=p('Zap');export const Maximize=p('Maximize');export default new Proxy({},{get:(_,n)=>p(n)});"
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
