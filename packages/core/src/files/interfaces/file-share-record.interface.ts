/**
 * A send: the files, the covering message, and who created it. The policy an operator chose lives on
 * each GRANT rather than here, because a share can be extended to a new recipient later under different
 * terms without rewriting what the earlier recipients were given.
 */
export interface IFileShareRecord {
  id: number;
  title: string;
  message: string;
  /** Media ids, stored as a JSON array. A malformed value reads as empty rather than throwing. */
  mediaIds: number[];
  createdBy: number | null;
}
