/** One cached storefront document: the encoded body exactly as it was sent, with the headers that described it. */
export interface IStoredDocument {
  body: Uint8Array;
  status: number;
  headers: [string, string][];
}
