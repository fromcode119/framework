/** One kept answer of ApiResponseCache: its bytes, status, the headers it is re-sent with, and when it was kept. */
export interface IStoredApiResponse {
  body: Buffer;
  status: number;
  headers: Array<[string, string]>;
  storedAt: number;
}
