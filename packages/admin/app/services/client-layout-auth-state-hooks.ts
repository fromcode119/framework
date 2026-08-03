import React from 'react';

import { Platform } from '@fromcode119/reactor';
import { usePathname, useRouter } from 'next/navigation';
import { AuthHooks } from '@/components/view/use-auth.client';

import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminPathUtils } from '@/lib/admin-path';
import { AuthUtils } from '@/lib/auth-utils';
import { RuntimeConstants } from '@fromcode119/core/client';
import { AdminServices } from '@/lib/admin-services';
import { InitializationStatusCache } from '@/app/services/initialization-status-cache';
import { AppEnv } from '@/lib/env';

export class ClientLayoutAuthStateHooks {
  private static readonly adminServices = AdminServices.getInstance();

  static useState() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading: isAuthLoading } = AuthHooks.useAuth();
    const normalizedPathname = React.useMemo(() => AdminPathUtils.stripBase(pathname || '/'), [pathname]);
    const isMinimalPath = normalizedPathname?.startsWith(AdminConstants.ROUTES.MINIMAL) || normalizedPathname?.startsWith('/minimal');
    const isAuthPage = React.useMemo(
      () => AdminConstants.ROUTES.AUTH.PUBLIC.some((route) => normalizedPathname?.startsWith(route)),
      [normalizedPathname],
    );
    const isSetupPath = React.useMemo(
      () => normalizedPathname?.startsWith(AdminConstants.ROUTES.AUTH.SETUP),
      [normalizedPathname],
    );
    const [isAdvancedMode, setIsAdvancedMode] = React.useState<boolean>(() => {
      if (!Platform.isBrowser) {
        return false;
      }

      return ClientLayoutAuthStateHooks.adminServices.uiPreference.readAdvancedMode();
    });
    const [isInitialized, setIsInitialized] = React.useState<boolean | null>(null);
    const initializationCheckKeyRef = React.useRef('');

    React.useEffect(() => {
      if (!Platform.isBrowser) {
        return;
      }

      const syncMode = () => setIsAdvancedMode(ClientLayoutAuthStateHooks.adminServices.uiPreference.readAdvancedMode());
      window.addEventListener(RuntimeConstants.ADMIN_UI.EVENTS.MODE_CHANGED, syncMode as EventListener);
      window.addEventListener('storage', syncMode as EventListener);

      return () => {
        window.removeEventListener(RuntimeConstants.ADMIN_UI.EVENTS.MODE_CHANGED, syncMode as EventListener);
        window.removeEventListener('storage', syncMode as EventListener);
      };
    }, []);

    React.useEffect(() => {
      const checkKey = isSetupPath ? 'setup' : 'default';
      if (initializationCheckKeyRef.current === checkKey) {
        return;
      }

      initializationCheckKeyRef.current = checkKey;
      const checkInitialization = async () => {
        try {
          const initialized = await InitializationStatusCache.get();

          setIsInitialized(initialized);

          if (!initialized && !isSetupPath) {
            AuthUtils.purgeAuth();
            router.push(AdminConstants.ROUTES.AUTH.SETUP);
            return;
          }

          if (initialized && isSetupPath) {
            router.push(AdminConstants.ROUTES.AUTH.LOGIN);
          }
        } catch (error) {
          console.error('[ClientLayout] Initialization check failed:', error);
          setIsInitialized((value) => (value === null ? true : value));
        }
      };

      checkInitialization();
    }, [isSetupPath, router]);

    React.useEffect(() => {
      if (isInitialized === true && !user && !isAuthPage && !isAuthLoading) {
        router.push(AdminConstants.ROUTES.AUTH.LOGIN);
      }
    }, [user, isInitialized, isAuthPage, isAuthLoading, router]);

    React.useEffect(() => {
      if (isAuthPage || !user || isInitialized !== true || !AppEnv.AI_ENABLED || isAdvancedMode) {
        return;
      }

      if (!isMinimalPath) {
        router.replace(AdminConstants.ROUTES.MINIMAL);
      }
    }, [isAuthPage, user, isInitialized, isAdvancedMode, isMinimalPath, router]);

    return {
      user,
      isAuthLoading,
      normalizedPathname,
      isMinimalPath,
      isAuthPage,
      isSetupPath,
      isAdvancedMode,
      isInitialized,
      router,
    };
  }
}
