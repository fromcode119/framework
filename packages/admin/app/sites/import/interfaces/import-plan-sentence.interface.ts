/**
 * One plain-language line about a kind of record, and whether it is something to act on.
 *
 * `warn` is not a severity — nothing in an opened row stops the import. It separates "this is what
 * you get" from "this is what to look at afterwards", so the two do not read as one grey paragraph.
 */
export interface IImportPlanSentence {
  text: string;
  warn: boolean;
}
