/**
 * One uniform alias record (every field present, empty when unused) so a consumer of `getSourceAliases`
 * sees ONE object type instead of a union of literal shapes. See `sourceAlias` below.
 */
export interface ISourceAlias {
  specifier: string;
  dir: string;
  entry: string;
  file: string;
  subpathsOnly: boolean;
}
