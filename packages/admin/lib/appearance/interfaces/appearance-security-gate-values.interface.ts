import type { ClientLayoutAuthStateHooks } from '@/app/services/client-layout-auth-state-hooks';

/** Hook values the {@link AppearanceSecurityGate} bridge reads before deciding what to render. */
export interface IAppearanceSecurityGateValues {
  authState: ReturnType<typeof ClientLayoutAuthStateHooks.useState>;
}
