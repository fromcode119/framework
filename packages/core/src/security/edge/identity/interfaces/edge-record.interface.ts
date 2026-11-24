/** One edge as Settings → Security → Edges shows it. Never a key or a token. */
export interface IEdgeRecord {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  /** Empty until the edge has used its token. */
  enrolledAt: string;
  /** Empty while the edge is in use. */
  revokedAt: string;
  revokedBy: string;
  lastSeenAt: string;
  lastAddress: string;
  version: string;
  certificateNotAfter: string;
}
