import type { ReactNode } from 'react';
import type { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import type { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';

/** What `StorefrontHydrator` decides and mounts from. */
export interface IStorefrontHydratorArgs {
  /** `#fc-root` — the element carrying the server-rendered theme tree; null when the document has none. */
  host: HTMLElement | null;
  config: FrontendRuntimeConfig;
  /** What the theme and eager plugin bundles registered before boot (layouts, slots). */
  registrations: PreBootRegistrationSeed;
  /** The tree that IS the server tree — hydrated in place. */
  hydrateTree: ReactNode;
  /** The fallback tree, given the server markup to hand over from (`ServerMarkupHandoff`). */
  fallbackTree: (serverHtml: string) => ReactNode;
  /** `location.search` of the document; defaults to the window's. */
  search?: string;
}
