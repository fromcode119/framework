/**
 * One redirect a plugin asks for: `fromPath` is a path on this site (`/old/page`), `toPath` a path or
 * an absolute url. `permanent` defaults to true (301); false makes it a 302.
 */
export interface IPluginRedirectRule {
  fromPath: string;
  toPath: string;
  permanent?: boolean;
  notes?: string;
}
