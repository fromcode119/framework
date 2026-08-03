import type { useRouter } from 'next/navigation';

/** Hook values the {@link AuthProvider} bridge reads and forwards to its view. */
export interface IAuthContextBridgeValues {
  router: ReturnType<typeof useRouter>;
}
