import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthHooks } from '@/components/use-auth';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminPathUtils } from '@/lib/admin-path';
import { AuthUtils } from '@/lib/auth-utils';
import { RuntimeConstants } from '@fromcode119/core/client';
import { AdminServices } from '@/lib/admin-services';
import { AppEnv } from '@/lib/env';

const adminServices = AdminServices.getInstance();
const INITIALIZATION_STATUS_TTL_MS = 5000;
const INITIALIZATION_ERROR_TTL_MS = 15000;

let initializationStatusPromise: Promise<boolean> | null = null;
let initializationStatusValue: boolean | null = null;
let initializationStatusExpiresAt = 0;
let initializationStatusError: unknown = null;
let initializationStatusErrorExpiresAt = 0;

async function getInitializationStatus(): Promise<boolean> {
  const now = Date.now();

  if (initializationStatusValue !== null && initializationStatusExpiresAt > now) {
    return initializationStatusValue;
  }

  if (initializationStatusError && initializationStatusErrorExpiresAt > now) {
    throw initializationStatusError;
  }

  if (initializationStatusPromise) {
    return initializationStatusPromise;
  }

  initializationStatusPromise = AdminApi.get(AdminConstants.ENDPOINTS.AUTH.STATUS)
    .then((data) => {
      const initialized = data.initialized === true;
      initializationStatusValue = initialized;
      initializationStatusExpiresAt = Date.now() + INITIALIZATION_STATUS_TTL_MS;
      initializationStatusError = null;
      initializationStatusErrorExpiresAt = 0;
      return initialized;
    })
    .catch((error) => {
      initializationStatusError = error;
      initializationStatusErrorExpiresAt = Date.now() + INITIALIZATION_ERROR_TTL_MS;
      throw error;
    })
    .finally(() => {
      initializationStatusPromise = null;
    });

  return initializationStatusPromise;
}

export class ClientLayoutAuthStateHooks {
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
      if (typeof window === 'undefined') {
        return false;
      }

      return adminServices.uiPreference.readAdvancedMode();
    });
    const [isInitialized, setIsInitialized] = React.useState<boolean | null>(null);
    const initializationCheckKeyRef = React.useRef('');

    React.useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const syncMode = () => setIsAdvancedMode(adminServices.uiPreference.readAdvancedMode());
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
          const initialized = await getInitializationStatus();

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
