'use client';

import { createRoot, hydrateRoot } from 'react-dom/client';

/**
 * react-dom's root factories — the one thing an application ENTRY must call and that no component can
 * wrap (a root exists before any component renders). They live here for the same reason `createPortal`
 * lives in `Reactor.portal()`: so an entry file never imports react-dom itself.
 *
 * They are deliberately NOT part of `ReactPrimitives`. `react-dom/client` is browser-only: React's
 * server-component compiler rejects any module that reaches it from a server graph, and reactor's barrel
 * is imported by server modules for `Enum`, `Reactor` and the decorators. Keeping the DOM roots in their
 * own `'use client'` module lets the barrel stay importable from a Server Component while an entry file
 * still gets its root factory from reactor.
 */
export class ReactDomRoots {
  static readonly createRoot = createRoot;
  static readonly hydrateRoot = hydrateRoot;
}
