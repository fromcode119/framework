export interface IScaffoldThemeResult {
  slug: string;
  name: string;
  path: string;
  /** Whether the theme was compiled. A theme that was not is never activated. */
  built: boolean;
  buildError: string | null;
  activated: boolean;
  activationError: string | null;
  manifest: any;
}
