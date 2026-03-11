export interface ScaffoldPluginInput {
  slug: string;
  name: string;
  description?: string;
  version?: string;
  activate?: boolean;
}
export interface ScaffoldPluginResult {
  slug: string;
  name: string;
  path: string;
  activated: boolean;
  activationError: string | null;
  manifest: any;
}
