/**
 * AuthControllerRegistration — abstract base with registration, email verification,
 * and frontend context helpers. Extracted from AuthControllerLifecycle (ARC-007).
 * AuthControllerLifecycle extends this class.
 */

import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerTokenSupport } from './auth-controller-token-support';

export abstract class AuthControllerRegistration extends AuthControllerTokenSupport {
  protected sanitizeAuthFlowContext(raw: any): Record<string, any> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const input = raw as Record<string, any>;
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) continue;
      if (value === undefined || value === null) continue;
      if (typeof value === 'string') { const trimmed = value.trim(); if (!trimmed) continue; output[normalizedKey] = trimmed; continue; }
      output[normalizedKey] = value;
    }
    return Object.keys(output).length ? output : undefined;
  }

  async register(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) return res.status(404).json({ error: 'Not found' });
    if (!(await this.isFrontendRegistrationEnabled())) return res.status(404).json({ error: 'Not found' });

    const { email, password, firstName, lastName, context } = req.body || {};
    const normalizedEmail = this.normalizeEmail(email);
    const flowContext = this.sanitizeAuthFlowContext(context);

    if (!normalizedEmail || !this.isValidEmail(normalizedEmail)) return res.status(400).json({ error: 'A valid email is required' });
    const passwordError = await this.validatePasswordAgainstPolicy(String(password || ''), { email: normalizedEmail });
    if (passwordError) return res.status(400).json({ error: passwordError });
    const existing = await this.db.findOne(SystemConstants.TABLE.USERS, { email: normalizedEmail });
    if (existing) return res.status(409).json({ error: 'Email is already registered' });

    const hashedPassword = await this.auth.hashPassword(String(password));
    const newUser: any = await this.db.insert(SystemConstants.TABLE.USERS, {
      email: normalizedEmail, password: hashedPassword, roles: ['customer'],
      firstName: String(firstName || '').trim() || null, lastName: String(lastName || '').trim() || null
    });

    await this.setUserAccountStatus(newUser.id, 'active');
    await this.setForcePasswordReset(newUser.id, false);
    await this.pushPasswordHistory(newUser.id, hashedPassword);
    await this.upsertMeta(this.getPasswordChangedAtKey(newUser.id), new Date().toISOString());

    const verification = await this.issueEmailVerificationToken(newUser.id, normalizedEmail, flowContext);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({ to: normalizedEmail, verificationUrl, firstName: String(firstName || '').trim() });

    this.manager.hooks.emit('auth:user:registered', { userId: newUser.id, email: normalizedEmail, context: flowContext });
    await this.manager.writeLog('INFO', `User registered: ${normalizedEmail}`, 'system', { userId: newUser.id, email: normalizedEmail, context: flowContext, emailVerificationSent: emailSent }).catch(() => {});

    if (!emailSent && process.env.NODE_ENV === 'production') return res.status(500).json({ error: 'Unable to send verification email. Please try again later.' });
    const response: Record<string, any> = { success: true, requiresEmailVerification: true, message: 'Registration successful. Please verify your email before signing in.', user: { id: String(newUser.id), email: normalizedEmail, roles: ['customer'] } };
    if (process.env.NODE_ENV !== 'production') { response.verificationUrl = verificationUrl; response.emailDelivery = emailSent ? 'sent' : 'failed'; }
    return res.status(201).json(response);
  }

  async verifyEmail(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) return res.status(404).json({ error: 'Not found' });
    const token = String(req.body?.token || req.query?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Verification token is required' });
    const result = await this.consumeEmailVerificationToken(token);
    if (!result.ok) return res.status(400).json({ error: result.reason === 'expired' ? 'Verification link has expired. Please request a new one.' : 'Invalid verification token' });
    this.manager.hooks.emit('auth:user:verified', { userId: result.userId, email: result.email, context: result.context });
    await this.manager.writeLog('INFO', `Email verified for user ${result.email}`, 'system', { userId: result.userId, email: result.email, context: result.context }).catch(() => {});
    return res.json({ success: true, message: 'Email verified successfully. You can now sign in.', user: { id: String(result.userId), email: result.email } });
  }

  async resendVerification(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) return res.status(404).json({ error: 'Not found' });
    const email = this.normalizeEmail(req.body?.email);
    if (!email || !this.isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { email });
    if (!user) return res.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
    const verified = await this.isEmailVerified(user.id);
    if (verified) return res.json({ success: true, message: 'Email is already verified.' });
    const verification = await this.issueEmailVerificationToken(user.id, email);
    const verificationUrl = await this.buildEmailVerificationUrl(req, verification.token);
    const emailSent = await this.sendVerificationEmail({ to: email, verificationUrl, firstName: String(user.firstName || '').trim() });
    if (!emailSent && process.env.NODE_ENV === 'production') return res.status(500).json({ error: 'Unable to send verification email. Please try again later.' });
    const response: Record<string, any> = { success: true, message: 'Verification email sent.' };
    if (process.env.NODE_ENV !== 'production') { response.verificationUrl = verificationUrl; response.emailDelivery = emailSent ? 'sent' : 'failed'; }
    return res.json(response);
  }

  // --- Frontend context helpers (used by subclass too) ---

  protected async isFrontendAuthEnabledForRequest(req: Request): Promise<boolean> {
    if (!this.isFrontendRequestContext(req)) return true;
    return this.getSettingBoolean(SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED, true);
  }

  protected async isFrontendRegistrationEnabled(): Promise<boolean> {
    return this.getSettingBoolean(SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED, true);
  }

  protected isFrontendRequestContext(req: Request): boolean {
    const clientHeader = String(req.get('x-framework-client') || '').trim().toLowerCase();
    if (clientHeader.includes('frontend')) return true;
    const originBase = this.getRequestOriginBaseUrl(req);
    if (originBase) { try { return new URL(originBase).hostname.startsWith('frontend.'); } catch { return false; } }
    const referer = String(req.get('referer') || '').trim();
    if (referer) { try { return new URL(referer).hostname.startsWith('frontend.'); } catch { return false; } }
    return false;
  }
}
