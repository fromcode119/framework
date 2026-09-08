import type { ClientLayoutAuthStateHooks } from '@/app/services/client-layout-auth-state-hooks';
import type { ClientLayoutNavigationStateHooks } from '@/app/services/client-layout-navigation-state-hooks';
import type { ClientLayoutSiteStateHooks } from '@/app/services/client-layout-site-state-hooks';

/** Hook values the {@link ClientLayoutShell} bridge reads before rendering the admin chrome. */
export interface IClientLayoutShellValues {
  authState: ReturnType<typeof ClientLayoutAuthStateHooks.useState>;
  navigationState: ReturnType<typeof ClientLayoutNavigationStateHooks.useState>;
  siteState: ReturnType<typeof ClientLayoutSiteStateHooks.useState>;
}
