import type { useRouter } from 'next/navigation';

/** Hook values the {@link RouterBridge} reads and forwards to its listener. */
export interface IRouterBridgeValues {
  router: ReturnType<typeof useRouter>;
}
