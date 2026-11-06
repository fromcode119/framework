/**
 * One redirect a plugin asks for: `fromPath` is a path on this site (`/old/page`), `toPath` a path or
 * an absolute url. `permanent` defaults to true (301); false makes it a 302. `gone: true` makes the path
 * answer 410 Gone instead — removed on purpose, with no replacement; `toPath` is then ignored.
 */
export interface IPluginRedirectRule {
  fromPath: string;
  toPath: string;
  permanent?: boolean;
  gone?: boolean;
  notes?: string;
}
