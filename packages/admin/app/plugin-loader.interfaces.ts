/** Type definitions for PluginLoader */

export interface AdminPluginMetadata {
  slug: string;
  name: string;
  admin?: {
    slots?: Array<{
      slot: string;
      component: string;
      file: string;
      priority: number;
    }>;
    menu?: Array<{
      label: string;
      path: string;
      icon: string;
    }>;
    collections?: Array<{
      slug: string;
      name?: string;
      fields: any[];
      admin?: any;
    }>;
  };
  ui?: {
    entry?: string;
    entryUrl?: string;
    css?: string[];
    cssUrls?: string[];
  };
}
