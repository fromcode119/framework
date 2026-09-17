import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { AuthControllerSso } from '@api/controllers/auth/auth-controller-sso';
import { GatewayReloadClient } from '@api/services/tenants/gateway-reload-client';
import { InitialSetupPreferences } from '@api/controllers/auth/initial-setup-preferences';
import { NetworkAddressUtils, SystemConstants } from '@fromcode119/core';
import { Request, Response } from 'express';
import { SetupMode } from '@fromcode119/core';

/**
 * Claiming a fresh deployment: the first account, and the settings that decide what it is.
 *
 * Runs ONCE, and only while every signal says the platform is untouched — no users, no tenants, no
 * console address, no completion marker. That is checked on the connection, not held in memory, and
 * a read that FAILS counts as "already set up", because the safe answer to "may a stranger claim
 * this platform" is no.
 *
 * Another link in the auth chain, added when auth-controller-lifecycle reached 402 lines. Setup and
 * login are different moments in a deployment's life that happened to share a file.
 */
export class AuthControllerSetup extends AuthControllerSso {
  /** Setup is single-flight per process: two browsers posting the wizard at once must not both claim it. */
  private setupInProgress = false;

  async setup(req: Request, res: Response) {
    if (this.setupInProgress) {
      return res.status(409).json({ error: 'System initialization is already in progress' });
    }

    this.setupInProgress = true;
    try {
      return await this.initializeSystem(req, res);
    } finally {
      this.setupInProgress = false;
    }
  }

  private async initializeSystem(req: Request, res: Response) {
    const { email, password } = req.body || {};
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const passwordError = await this.validatePasswordAgainstPolicy(String(password), {
      email: normalizedEmail
    });
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashedPassword = await this.auth.hashPassword(String(password));
    let newUser: any;
    try {
      newUser = await this.createInitialUser(normalizedEmail, hashedPassword);
    } catch (error) {
      this.logger.error(`[AuthController] Setup initialization failed: ${error}`);
      return res.status(503).json({ error: 'System initialization state is temporarily unavailable' });
    }
    if (!newUser) return res.status(400).json({ error: 'System already initialized' });

    await this.setEmailVerified(newUser.id, true);
    await this.setUserAccountStatus(newUser.id, AccountStatus.ACTIVE);
    await this.setForcePasswordReset(newUser.id, false);
    await this.pushPasswordHistory(newUser.id, hashedPassword);
    await this.upsertMeta(this.getPasswordChangedAtKey(newUser.id), new Date().toISOString());
    await this.persistSetupPreferences(req.body);
    await this.completeSetup(req);

    const loginResult = await this.issueLoginSession(req, res, newUser);

    await this.manager.writeLog(
      'INFO',
      `System initialized. Admin account created: ${normalizedEmail}`,
      'system',
      { userId: newUser.id, email: normalizedEmail, ip: NetworkAddressUtils.resolveClientIp(req) }
    ).catch(() => {});

    res.json({
      token: loginResult.token,
      user: loginResult.user
    });
  }

  /**
   * The wizard's platform answers, written AFTER the account exists: the account is the thing that
   * must not be lost, and a rejected timezone is not a reason to fail an initialization that already
   * created it. Only what was actually sent is stored — see InitialSetupPreferences.
   */
  /**
   * Close setup, and remember the address the operator actually used to reach it.
   *
   * The console URL is DERIVED, not invented: it is the host this very request arrived on, which the
   * operator demonstrably just used. Writing it means the gateway has a console host to route by from
   * the next request onward, which is what ends setup mode for every future boot — the marker below
   * is the belt to that braces.
   *
   * An address already configured is never overwritten: a deployment that was given one in env has
   * seeded it, and the operator's own value outranks anything derived here.
   */
  private async completeSetup(req: Request): Promise<void> {
    try {
      const existing = String((await this.manager.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_URL }))?.value ?? '').trim();
      if (!existing) {
        // What the operator CONFIRMED on the last step, which was prefilled with the address they
        // reached the wizard on. The header is the fallback for a setup posted without it — the
        // value is still derived from a request they made, never invented here.
        const confirmed = this.parseAbsoluteUrl(req.body?.adminUrl);
        const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
        const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
        const resolved = confirmed || (host ? `${proto}://${host}` : '');
        if (resolved) await this.upsertMeta(SystemConstants.META_KEY.ADMIN_URL, resolved);
      }

      await this.upsertMeta(SystemConstants.META_KEY.SETUP_COMPLETED, 'true');
      SetupMode.complete();
      // The console host just changed, so the gateway needs to hear about it now rather than at its
      // next refresh — otherwise the operator is redirected to an address that answers unknown_host.
      void new GatewayReloadClient().notify();
    } catch (error: unknown) {
      // A setup that created the admin account but could not write the marker must NOT fail: the
      // account exists, and `userCount > 0` alone keeps setup mode shut on the next boot.
      this.logger.error(`[AuthController] Could not record setup completion: ${String((error as Error)?.message ?? error)}`);
    }
  }

  /** An absolute http(s) URL, or empty. A value that will not parse is discarded, never stored. */
  private parseAbsoluteUrl(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return `${url.protocol}//${url.host}`;
    } catch {
      return '';
    }
  }

  private async persistSetupPreferences(body: Record<string, unknown> | undefined): Promise<void> {
    for (const [key, value] of InitialSetupPreferences.fromRequestBody(body).entries) {
      try {
        await this.upsertMeta(key, value);
      } catch (error) {
        this.logger.error(`[AuthController] Setup could not store ${key}: ${error}`);
      }
    }
  }

  /** Names the section this must not race with; how it is serialised is the driver's business. */
  private static readonly INITIAL_ADMIN_LOCK = 'fromcode.initial-admin-setup';

  /**
   * Wins the right to create the first user, exclusively.
   *
   * The check and the insert must be one indivisible step: two API replicas both seeing "no users yet"
   * would both create an administrator nobody intended. This used to hold a Postgres advisory lock
   * here, in the controller, and every other driver took an unguarded check-then-insert — so the race
   * was open on SQLite and MySQL while the comment said it was handled. The lock now belongs to the
   * database layer, which is the only place that knows how each driver serialises, and a driver with no
   * strategy refuses rather than pretending.
   */
  private async createInitialUser(email: string, password: string): Promise<any | null> {
    return this.db.withExclusiveLock(AuthControllerSetup.INITIAL_ADMIN_LOCK, async () => {
      if ((await this.db.count(SystemConstants.TABLE.USERS)) > 0) return null;
      return this.insertInitialUser(email, password);
    });
  }

  /**
   * The first account, and the only moment the platform OWNER can be identified.
   *
   * `roles: ['admin']` alone is a TENANT administrator — `admin` is not platform admin, deliberately
   * (a tenant's admin must not be able to install platform code). But `is_platform_admin` is what
   * grants every site and what the platform-scoped screens check, so an install whose founding
   * account lacks it is locked out of its own platform the moment a first site exists: the console
   * answers "No site access — your account is not a member of any site yet", and there is nobody with
   * the authority to add them.
   *
   * Migration 029 deliberately refuses to invent an owner on an EXISTING install, because that would
   * hand someone powers no operator granted. This is the opposite case and the reason that rule can
   * be safe: there are no users at all, so there is no one to promote over — and whoever is standing
   * here is the person installing the platform. Ownership is a single transferable seat enforced by a
   * partial unique index; granting it here fills that seat once, under the same exclusive lock that
   * guarantees this is the first account.
   */
  private async insertInitialUser(email: string, password: string): Promise<any> {
    return this.db.insert(SystemConstants.TABLE.USERS, {
      email,
      password,
      roles: ['admin'],
      is_platform_admin: true,
    });
  }
}
