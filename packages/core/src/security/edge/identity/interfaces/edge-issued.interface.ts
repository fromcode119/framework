/** What an edge receives on enrolling or renewing: its certificate, the chain to send with it, and the root to trust. */
export interface IEdgeIssued {
  edgeId: string;
  certificatePem: string;
  chainPem: string;
  trustPem: string;
  notAfter: string;
}
