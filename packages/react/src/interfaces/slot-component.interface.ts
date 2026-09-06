import type { ComponentType } from 'react';

export interface ISlotComponent {
  component: ComponentType<any>;
  priority: number;
  pluginSlug: string;
  /**
   * The raw module loader behind a code-split (`React.lazy`) override, when it has one. The server
   * registry awaits it to render the real component; the storefront runtime awaits it BEFORE
   * `hydrateRoot`, so a dehydrated boundary never has to wait for a chunk while the page updates.
   */
  loader?: () => Promise<{ default: ComponentType<any> }>;
}
