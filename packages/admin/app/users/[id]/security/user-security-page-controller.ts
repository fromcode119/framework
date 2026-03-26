import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { NotificationHooks } from '@/components/use-notification';
import { AuthHooks } from '@/components/use-auth';
import { UserSecurityPageService } from './user-security-page-service';
import type {
  AuthActivityEntry,
  AuthUserRecord,
  SecurityUserRecord,
  UserApiTokenRecord,
  UserSecurityPageModel,
  UserSessionRecord,
  UserTwoFactorSetupResponse,
  UserTwoFactorStatusResponse,
  UserTwoFactorVerifyResponse,
} from './user-security-page.interfaces';

export class UserSecurityPageController {
  static useModel(): UserSecurityPageModel {
    const router = useRouter();
    const { theme } = ThemeHooks.useTheme();
    const params = useParams<{ id: string }>();
    const { user: authUser } = AuthHooks.useAuth() as { user?: AuthUserRecord };
    const { addNotification } = NotificationHooks.useNotification();
    const id = String(params.id || '');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<SecurityUserRecord | null>(null);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [isEnabling, setIsEnabling] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isRegeneratingCodes, setIsRegeneratingCodes] = useState(false);
    const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0);
    const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState<string[]>([]);
    const [authActivity, setAuthActivity] = useState<AuthActivityEntry[]>([]);
    const [authActivityLoading, setAuthActivityLoading] = useState(false);
    const [mySessions, setMySessions] = useState<UserSessionRecord[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [myApiTokens, setMyApiTokens] = useState<UserApiTokenRecord[]>([]);
    const [tokensLoading, setTokensLoading] = useState(false);
    const [tokenName, setTokenName] = useState('');
    const [tokenDays, setTokenDays] = useState('30');
    const [createdToken, setCreatedToken] = useState('');
    const isSelf = UserSecurityPageService.isSameUser(authUser?.id, id);

    const fetchAuthActivity = async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setAuthActivity([]);
        return;
      }
      setAuthActivityLoading(true);
      try {
        const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.LOGS}?page=1&limit=25&search=${encodeURIComponent(normalizedEmail)}`);
        setAuthActivity(UserSecurityPageService.filterAuthActivity(normalizedEmail, UserSecurityPageService.extractActivityEntries(response)));
      } catch (error) {
        console.error('[UserSecurityPage] Failed to fetch auth activity:', error);
        setAuthActivity([]);
      } finally {
        setAuthActivityLoading(false);
      }
    };

    const fetchUserSecurity = async () => {
      try {
        const userData = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(id)) as SecurityUserRecord;
        setUser(userData);
        const twoFactorStatus = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_STATUS(id)) as UserTwoFactorStatusResponse;
        await fetchAuthActivity(String(userData?.email || ''));
        setTwoFactorEnabled(Boolean(twoFactorStatus.enabled));
        setRecoveryCodesRemaining(Number(twoFactorStatus.recoveryCodesRemaining || 0));
      } catch (error) {
        console.error('[UserSecurityPage] Failed to fetch user security:', error);
        addNotification({ title: 'Error', message: 'Failed to load security settings', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    const fetchMySessions = async () => {
      if (!isSelf) return;
      setSessionsLoading(true);
      try {
        const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.MY_SESSIONS);
        setMySessions(UserSecurityPageService.extractSessions(response));
      } catch (error) {
        console.error('[UserSecurityPage] Failed to fetch sessions:', error);
        setMySessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };

    const fetchMyApiTokens = async () => {
      if (!isSelf) return;
      setTokensLoading(true);
      try {
        const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.API_TOKENS);
        setMyApiTokens(UserSecurityPageService.extractApiTokens(response));
      } catch (error) {
        console.error('[UserSecurityPage] Failed to fetch API tokens:', error);
        setMyApiTokens([]);
      } finally {
        setTokensLoading(false);
      }
    };

    useEffect(() => {
      void fetchUserSecurity();
    }, [id]);

    useEffect(() => {
      if (!isSelf) return;
      void fetchMySessions();
      void fetchMyApiTokens();
    }, [isSelf]);

    return {
      authActivity,
      authActivityLoading,
      copyRecoveryCodes: async () => {
        if (!generatedRecoveryCodes.length) return;
        try {
          await navigator.clipboard.writeText(generatedRecoveryCodes.join('\n'));
          addNotification({ title: 'Copied', message: 'Recovery codes copied to clipboard.', type: 'success' });
        } catch {
          addNotification({ title: 'Copy Failed', message: 'Please copy the recovery codes manually.', type: 'error' });
        }
      },
      createApiToken: async () => {
        try {
          if (!tokenName.trim()) {
            addNotification({ title: 'Name Required', message: 'Enter a token name first.', type: 'error' });
            return;
          }
          const response = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.API_TOKENS, UserSecurityPageService.buildApiTokenPayload(tokenName, tokenDays));
          setCreatedToken(String((response as { token?: string })?.token || ''));
          setTokenName('');
          addNotification({ title: 'Token Created', message: 'Copy the token now. It is shown once.', type: 'success' });
          await fetchMyApiTokens();
        } catch (error: any) {
          addNotification({ title: 'Error', message: error?.message || 'Failed to create API token', type: 'error' });
        }
      },
      createdToken,
      generatedRecoveryCodes,
      handleDisable2FA: async () => {
        if (!confirm('Are you sure you want to disable 2FA for this user? This will reduce account security.')) return;
        try {
          await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA(id));
          setTwoFactorEnabled(false);
          setQrCode(null);
          setSecret(null);
          setGeneratedRecoveryCodes([]);
          setRecoveryCodesRemaining(0);
          addNotification({ title: '2FA Disabled', message: 'Two-factor authentication has been removed', type: 'info' });
        } catch (error: any) {
          addNotification({ title: 'Error', message: error.message || 'Failed to disable 2FA', type: 'error' });
        }
      },
      handleEnable2FA: async () => {
        setIsEnabling(true);
        try {
          const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_SETUP(id), {}) as UserTwoFactorSetupResponse;
          setQrCode(response.qrCode || null);
          setSecret(response.secret || null);
          addNotification({ title: 'Setup Started', message: 'Scan the QR code with your authenticator app', type: 'info' });
        } catch (error: any) {
          addNotification({ title: 'Setup Failed', message: error.message || 'Failed to generate 2FA setup', type: 'error' });
        } finally {
          setIsEnabling(false);
        }
      },
      handleRegenerateRecoveryCodes: async () => {
        if (!confirm('Regenerate recovery codes? Existing unused codes will stop working immediately.')) return;
        setIsRegeneratingCodes(true);
        try {
          const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_RECOVERY_REGENERATE(id), {}) as UserTwoFactorVerifyResponse;
          const codes = Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
          setGeneratedRecoveryCodes(codes);
          setRecoveryCodesRemaining(codes.length);
          addNotification({ title: 'Recovery Codes Regenerated', message: 'Save the new codes now. Old codes are invalid.', type: 'success' });
        } catch (error: any) {
          addNotification({ title: 'Regeneration Failed', message: error.message || 'Unable to regenerate recovery codes.', type: 'error' });
        } finally {
          setIsRegeneratingCodes(false);
        }
      },
      handleVerify2FA: async () => {
        if (verificationCode.length !== 6) {
          addNotification({ title: 'Invalid Code', message: 'Please enter a 6-digit verification code', type: 'error' });
          return;
        }
        setIsVerifying(true);
        try {
          const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USER_2FA_VERIFY(id), { token: verificationCode }) as UserTwoFactorVerifyResponse;
          const recoveryCodes = Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
          setTwoFactorEnabled(true);
          setQrCode(null);
          setSecret(null);
          setVerificationCode('');
          setGeneratedRecoveryCodes(recoveryCodes);
          setRecoveryCodesRemaining(recoveryCodes.length);
          addNotification({ title: '2FA Enabled', message: 'Two-factor authentication is now active', type: 'success' });
        } catch (error: any) {
          addNotification({ title: 'Verification Failed', message: error.message || 'Invalid verification code', type: 'error' });
        } finally {
          setIsVerifying(false);
        }
      },
      id,
      isEnabling,
      isRegeneratingCodes,
      isSelf,
      isVerifying,
      loading,
      myApiTokens,
      mySessions,
      qrCode,
      recoveryCodesRemaining,
      revokeApiToken: async (tokenId) => {
        try {
          await AdminApi.delete(AdminConstants.ENDPOINTS.AUTH.API_TOKEN(tokenId));
          addNotification({ title: 'Token Revoked', message: 'API token revoked successfully.', type: 'success' });
          await fetchMyApiTokens();
        } catch (error: any) {
          addNotification({ title: 'Error', message: error?.message || 'Failed to revoke API token', type: 'error' });
        }
      },
      revokeOtherSessions: async () => {
        try {
          await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.REVOKE_OTHER_SESSIONS, {});
          addNotification({ title: 'Done', message: 'Other sessions revoked.', type: 'success' });
          await fetchMySessions();
        } catch (error: any) {
          addNotification({ title: 'Error', message: error?.message || 'Failed to revoke other sessions', type: 'error' });
        }
      },
      revokeSession: async (sessionId) => {
        try {
          const response = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.REVOKE_MY_SESSION(sessionId), {}) as { revokedCurrent?: boolean };
          addNotification({ title: 'Session Revoked', message: 'Device session revoked successfully.', type: 'success' });
          if (response.revokedCurrent) {
            router.push(AdminConstants.ROUTES.AUTH.LOGIN);
            return;
          }
          await fetchMySessions();
        } catch (error: any) {
          addNotification({ title: 'Error', message: error?.message || 'Failed to revoke session', type: 'error' });
        }
      },
      routerBackHref: AdminConstants.ROUTES.USERS.DETAIL(id),
      secret,
      sessionsLoading,
      setTokenDays,
      setTokenName,
      setVerificationCode: (value) => setVerificationCode(value.replace(/\D/g, '')),
      themeMode: theme,
      tokenDays,
      tokenName,
      tokensLoading,
      twoFactorEnabled,
      user,
      verificationCode,
    };
  }
}
