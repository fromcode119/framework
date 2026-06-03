import type { PluginEntry } from '@fromcode119/core/client';
import type { PluginInstallOperation } from '@/lib/plugin-install-operation.interfaces';

export interface MarketplaceDetailPageProps {
  params: Promise<{ slug: string }>;
}

export interface MarketplaceDetailPageState {
  routeSlug: string;
  resolved: boolean;
  plugin: PluginEntry | null;
  allVersions: PluginEntry[];
  selectedVersion: string;
  installedPlugin: any | null;
  loading: boolean;
  error: string | null;
  installing: boolean;
  installOperation: PluginInstallOperation | null;
  activeImageIndex: number;
  showLightbox: boolean;
}
