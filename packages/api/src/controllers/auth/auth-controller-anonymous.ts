import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { CoercionUtils, NetworkAddressUtils, PersonalDataErasureService, SystemConstants } from '@fromcode119/core';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { AuthControllerSso } from '@api/controllers/auth/auth-controller-sso';
import { SsoIdentity } from '@api/controllers/auth/sso/sso-identity';
import { SsoSignInError } from '@api/controllers/auth/sso/enums/sso-sign-in-error.enum';

/**
 * Starting someone in an app without an account, and adding one to it later.
 *
 * `anonymousSignIn` creates an account with no real email — its address ends in the reserved `.invalid`
 * domain, so no mail is ever sent to it — and a long random password that only the app holds. The app
 * keeps both on the phone and signs in with them like anyone else when its session runs out, so the
 * person keeps everything without ever having typed a thing. Only where the site lets apps start people
 * this way and lets them sign up at all; a limited number per network address an hour. `anonymousAvailability`
 * tells the app beforehand whether it may.
 *
 * `linkAnonymous` turns that account into a normal one, keeping its id and so everything stored for it:
 * an email and password (verified by email, as at sign-up), or a provider's verified email. An email that
 * already has an account is MERGED into it once the person proves it is theirs (its password, or the
 * provider's verified email): plugins move the guest's records over on `auth:user:merging`, the guest
 * account is erased and locked, and the person is signed in to the existing account.
 */
export class AuthControllerAnonymous extends AuthControllerSso {
  private static readonly DOMAIN = 'anonymous.invalid';
  // Phones on a mobile network share a few public addresses, so the limit allows a crowd, not a script.
  private static readonly PER_ADDRESS_PER_HOUR = 20;
  private static readonly WINDOW_MS = 60 * 60 * 1000;
  private static readonly starts = new Map<string, number[]>();

  /** Public: whether this app may start someone without an account, so it offers that only where it works. */
  async anonymousAvailability(req: Request, res: Response) {
    return res.json({ available: await this.mayStartAnonymously(req) });
  }

  async anonymousSignIn(req: Request, res: Response) {
    if (!(await this.mayStartAnonymously(req))) return res.status(404).json({ error: 'Not found' });
    if (this.parseUserId((req as any)?.user?.id)) return res.status(409).json({ error: 'You are already signed in' });
    if (AuthControllerAnonymous.overLimit(NetworkAddressUtils.resolveClientIp(req) || '')) {
      return res.status(429).json({ error: 'too_many_requests' });
    }

    const email = `anon-${randomBytes(12).toString('hex')}@${AuthControllerAnonymous.DOMAIN}`;
    const password = randomBytes(32).toString('base64url');
    const hashed = await this.auth.hashPassword(password);
    const user: any = await this.db.insert(SystemConstants.TABLE.USERS, { email, password: hashed, roles: ['customer'], firstName: null, lastName: null });
    await this.setUserAccountStatus(user.id, AccountStatus.ACTIVE);
    await this.setForcePasswordReset(user.id, false);
    await this.pushPasswordHistory(user.id, hashed);
    await this.upsertMeta(this.getPasswordChangedAtKey(user.id), new Date().toISOString());
    // Signing in with these credentials must not wait on an email nobody can receive.
    await this.setEmailVerified(user.id, true);
    await this.upsertMeta(this.getAnonymousKey(user.id), 'true');
    await this.joinStorefrontSite(req, user.id);
    this.manager.hooks.emit('auth:user:registered', { userId: user.id, email, context: { anonymous: true } });
    await this.manager.writeLog('INFO', 'Anonymous app account started', 'system', { userId: user.id, ip: NetworkAddressUtils.resolveClientIp(req) }).catch(() => {});

    const login = await this.issueLoginSession(req, res, user);
    return res.status(201).json({ token: login.token, user: login.user, credentials: { email, password } });
  }

  async linkAnonymous(req: Request, res: Response) {
    const userId = this.parseUserId((req as any)?.user?.id);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (!(await this.isAnonymousAccount(userId))) return res.status(409).json({ error: 'not_anonymous' });

    const provider = CoercionUtils.toKey(req.body?.provider);
    if (provider) return this.linkProvider(req, res, userId, provider);

    const email = this.normalizeEmail(req.body?.email);
    const password = CoercionUtils.toString(req.body?.password);
    const firstName = CoercionUtils.toString(req.body?.firstName).trim() || null;
    if (!email || !this.isValidEmail(email) || email.endsWith(`@${AuthControllerAnonymous.DOMAIN}`)) return res.status(400).json({ error: 'A valid email is required' });
    const existing = await this.db.findOne(SystemConstants.TABLE.USERS, { email });
    if (existing) return this.mergeByPassword(req, res, userId, existing, password);
    const passwordError = await this.validatePasswordAgainstPolicy(password, { userId, email });
    if (passwordError) return res.status(400).json({ error: passwordError });

    const hashed = await this.auth.hashPassword(password);
    await this.db.update(SystemConstants.TABLE.USERS, { id: userId }, { email, password: hashed, firstName, updatedAt: new Date() });
    await this.pushPasswordHistory(userId, hashed);
    await this.upsertMeta(this.getPasswordChangedAtKey(userId), new Date().toISOString());
    await this.setEmailVerified(userId, false);
    await this.deleteMeta(this.getAnonymousKey(userId));
    const verification = await this.issueEmailVerificationToken(userId, email);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({ to: email, verificationUrl, firstName: firstName ?? '' });
    await this.manager.writeLog('INFO', `Anonymous app account linked to ${email}`, 'system', { userId, email, emailVerificationSent: emailSent }).catch(() => {});
    return res.json({ success: true, requiresEmailVerification: true, emailDelivery: emailSent ? 'sent' : 'failed', user: { id: String(userId), email, anonymous: false } });
  }

  /** A provider's verified email becomes the account's; the person then signs in with that provider. */
  private async linkProvider(req: Request, res: Response, userId: number, provider: string) {
    if (!(await this.getConfiguredSsoProviders()).includes(provider)) {
      return res.status(SsoSignInError.NOT_ENABLED.status).json({ error: SsoSignInError.NOT_ENABLED.value });
    }
    let payload: any;
    try {
      payload = await this.manager.hooks.call('auth:sso:resolve-user', {
        provider, idToken: CoercionUtils.toString(req.body?.idToken), accessToken: CoercionUtils.toString(req.body?.accessToken),
        profile: req.body?.profile || null, ip: NetworkAddressUtils.resolveClientIp(req), userAgent: req.headers['user-agent'],
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'SSO provider rejected this login' });
    }
    const identity = SsoIdentity.from(payload);
    if (!identity.emailVerified || !identity.email || !this.isValidEmail(identity.email)) {
      return res.status(SsoSignInError.UNVERIFIED_EMAIL.status).json({ error: SsoSignInError.UNVERIFIED_EMAIL.value });
    }
    const existing = await this.db.findOne(SystemConstants.TABLE.USERS, { email: identity.email });
    if (existing) return this.mergeInto(req, res, userId, existing);
    await this.db.update(SystemConstants.TABLE.USERS, { id: userId }, { email: identity.email, firstName: identity.firstName, lastName: identity.lastName, updatedAt: new Date() });
    await this.setEmailVerified(userId, true);
    await this.deleteMeta(this.getAnonymousKey(userId));
    await this.manager.writeLog('INFO', `Anonymous app account linked to ${identity.email} via ${provider}`, 'system', { userId, provider }).catch(() => {});
    return res.json({ success: true, requiresEmailVerification: false, user: { id: String(userId), email: identity.email, anonymous: false } });
  }

  /** The existing account's password is the proof, throttled like a sign-in; an account with two-step sign-in is not merged by password alone. */
  private async mergeByPassword(req: Request, res: Response, fromUserId: number, target: any, password: string) {
    const email = this.normalizeEmail(target.email);
    const throttleKey = this.getLoginThrottleKey(email, NetworkAddressUtils.resolveClientIp(req) || '');
    const throttleSettings = await this.getLoginThrottleSettings();
    if (this.isLoginLocked(await this.readLoginThrottleState(throttleKey))) return res.status(429).json({ error: 'Too many failed login attempts. Please try again later.' });
    if (!password || !(await this.auth.comparePassword(password, String(target.password || '')))) {
      await this.recordLoginFailure(throttleKey, throttleSettings);
      return res.status(409).json({ error: 'Email is already registered', merge: 'wrong_password' });
    }
    await this.clearLoginThrottleState(throttleKey);
    if ((await this.readMetaRow(`user:${target.id}:2fa_enabled`))?.value === 'true') return res.status(409).json({ error: 'two_factor_required' });
    if (await this.requiresEmailVerification(target.id)) return res.status(403).json({ error: 'Email not verified', requiresEmailVerification: true });
    return this.mergeInto(req, res, fromUserId, target);
  }

  /** Hands the guest's records to the existing account, closes the guest and signs the person in to that account. */
  private async mergeInto(req: Request, res: Response, fromUserId: number, target: any) {
    const intoUserId = this.parseUserId(target.id);
    if (!intoUserId || intoUserId === fromUserId) return res.status(409).json({ error: 'Email is already registered' });
    if (await this.isAnonymousAccount(intoUserId)) return res.status(409).json({ error: 'Email is already registered' });
    if (await this.getUserAccountStatus(intoUserId) === AccountStatus.SUSPENDED) return res.status(403).json({ error: 'Account is suspended. Please contact support.' });

    await this.manager.hooks.call('auth:user:merging', { fromUserId, intoUserId });
    const guest = await this.db.findOne(SystemConstants.TABLE.USERS, { id: fromUserId });
    await new PersonalDataErasureService(this.db).eraseAll({ email: String(guest?.email ?? ''), userId: fromUserId });
    const lockedHash = await this.auth.hashPassword(`merged-${fromUserId}-${randomBytes(16).toString('hex')}`);
    await this.db.update(SystemConstants.TABLE.USERS, { id: fromUserId }, { password: lockedHash, updatedAt: new Date() });
    await this.deleteMeta(this.getAnonymousKey(fromUserId));
    await this.revokeAllSessionsForUser(fromUserId);
    this.manager.hooks.emit('auth:user:merged', { fromUserId, intoUserId });
    await this.manager.writeLog('INFO', `Anonymous app account ${fromUserId} merged into ${intoUserId}`, 'system', { fromUserId, intoUserId }).catch(() => {});

    const login = await this.issueLoginSession(req, res, target);
    return res.json({ success: true, merged: true, requiresEmailVerification: false, token: login.token, user: login.user });
  }

  /** Apps only (never the website or the console), and only where the site allows sign-up and anonymous starts. */
  private async mayStartAnonymously(req: Request): Promise<boolean> {
    if (this.isFrontendRequestContext(req)) return false;
    if (!(await this.isFrontendAuthEnabledForRequest(req)) || !(await this.isFrontendRegistrationEnabledForRequest(req))) return false;
    return this.getSettingBoolean(SystemConstants.META_KEY.APP_ANONYMOUS_ENABLED, false);
  }

  /** Counts a start from this address and answers whether it is over the hourly limit. */
  private static overLimit(address: string, now = Date.now()): boolean {
    const recent = (AuthControllerAnonymous.starts.get(address) ?? []).filter((at) => now - at < AuthControllerAnonymous.WINDOW_MS);
    if (recent.length >= AuthControllerAnonymous.PER_ADDRESS_PER_HOUR) return true;
    recent.push(now);
    AuthControllerAnonymous.starts.set(address, recent);
    if (AuthControllerAnonymous.starts.size > 50_000) AuthControllerAnonymous.starts.clear();
    return false;
  }
}
