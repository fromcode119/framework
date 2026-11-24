import type net from 'net';
import type { EdgeOriginConfig } from '@cli/services/edge/config/edge-origin-config';

/** A server the edge passes connections to. Another transport is a new class, not a change to the edge. */
export interface IEdgeOrigin {
  readonly config: EdgeOriginConfig;
  start(): Promise<void>;
  stop(): void;
  /** Whether it can take connections now — part of `/ready`. */
  readonly ready: boolean;
  /**
   * A connection to the server for a visitor on a `protocol` listener, with `header` (the PROXY v2 header
   * naming the visitor, or null) already written — or null when the server cannot be reached.
   */
  connect(protocol: string, header: Buffer | null, publicPort: number, startedAt: number): Promise<net.Socket | null>;
}
