/** A file read for import, held until the operator confirms it. */
export interface IListImportDraft {
  fileName: string;
  records: unknown[];
}
