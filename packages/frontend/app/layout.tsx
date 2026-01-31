import type { Metadata } from "next";
import "./globals.css";
import GlobalInitializer from "./GlobalInitializer";
import RootProvider from "./RootProvider";
import PluginLoader from "./PluginLoader";

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
      "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, version } = window.React;",
      "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const render = (...args) => rd.render(...args); export const hydrate = (...args) => rd.hydrate(...args); export const createPortal = (...args) => rd.createPortal(...args); export const createRoot = (...args) => rd.createRoot(...args);",
      "@fromcode/react": "data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, PluginsProvider, getIcon, createProxyIcon } = window.Fromcode;",
      "react/jsx-runtime": "data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment;",
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
        <GlobalInitializer />
        <RootProvider>
          <PluginLoader />
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

