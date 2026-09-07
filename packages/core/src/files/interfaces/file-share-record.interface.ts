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
  /**
   * What ELSE this share points at, when it is not (only) files: a plugin's own record kind, named in
   * that plugin's terms, and the ids within it. Empty for a plain file share, which is what every share
   * was until records could be shared too. The framework never interprets these — the owning plugin
   * resolves them — so one plugin's naming can never collide with another's.
   */
  resourceType: string;
  resourceIds: string[];
  createdBy: number | null;
}
