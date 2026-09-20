/** A resolved `next/image` remote pattern candidate, before Next's own richer `RemotePattern` shape. */
export interface IRemotePatternCandidate {
  protocol: string;
  hostname: string;
}
