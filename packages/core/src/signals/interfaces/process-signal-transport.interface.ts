/** Carries signal messages between api processes. Each message reaches every subscriber, the sender's own included. */
export interface IProcessSignalTransport {
  publish(message: string): Promise<void>;
  subscribe(onMessage: (message: string) => void): Promise<void>;
  close(): Promise<void>;
}
