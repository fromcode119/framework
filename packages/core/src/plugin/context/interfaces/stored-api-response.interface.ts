/**
 * One kept answer of ApiResponseCache: its plain bytes, the same bytes gzipped when the answer was sent
 * compressed, status, the headers it is re-sent with, and when it was kept.
 */
export interface IStoredApiResponse {
  body: Buffer;
  gzipped?: Buffer;
  status: number;
  headers: Array<[string, string]>;
  storedAt: number;
}
