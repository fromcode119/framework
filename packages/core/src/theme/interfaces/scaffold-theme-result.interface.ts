export interface IScaffoldThemeResult {
  slug: string;
  name: string;
  path: string;
  activated: boolean;
  activationError: string | null;
  manifest: any;
}
