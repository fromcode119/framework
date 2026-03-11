export interface ScaffoldThemeInput {
  slug: string;
  name: string;
  description?: string;
  version?: string;
  activate?: boolean;
}
export interface ScaffoldThemeResult {
  slug: string;
  name: string;
  path: string;
  activated: boolean;
  activationError: string | null;
  manifest: any;
}
