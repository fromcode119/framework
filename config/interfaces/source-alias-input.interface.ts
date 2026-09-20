/** Input shape accepted by `sourceAlias`: only `specifier` is required, the rest default to empty. */
export interface ISourceAliasInput {
  specifier: string;
  dir?: string;
  entry?: string;
  file?: string;
  subpathsOnly?: boolean;
}
