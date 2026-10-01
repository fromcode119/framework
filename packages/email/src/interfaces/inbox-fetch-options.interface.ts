/** Which messages to read: those after `sinceUid`, at most `limit` of them. */
export interface IInboxFetchOptions {
  sinceUid?: number;
  limit?: number;
}
