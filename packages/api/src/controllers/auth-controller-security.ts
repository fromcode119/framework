import { Response } from 'express';
import { randomBytes } from 'crypto';
import { users, eq } from '@fromcode/database';
import { AuthControllerAccount } from './auth-controller-account';
import type { ApiTokenRecord } from './auth-controller-types';

export class AuthControllerSecurity extends AuthControllerAccount {
  async getMySecurityState(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await this.db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows: any[]) => rows?.[0]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const status = await this.getUserAccountStatus(userId);
    const forcePasswordReset = await this.getForcePasswordReset(userId);
    const emailVerified = await this.isEmailVerified(userId);
    const policy = await this.getPasswordPolicySettings();
    const changedAt = await this.getMetaValue(this.getPasswordChangedAtKey(userId));

    return res.json({
      user: {
        id: userId,
        email: this.normalizeEmail(user.email)
      },
      account: {
        status,
        forcePasswordReset,
        emailVerified,
        passwordChangedAt: changedAt || null
      },
      passwordPolicy: {
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumber: policy.requireNumber,
        requireSymbol: policy.requireSymbol
      }
    });
  }

  async listMyApiTokens(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const records = await this.readApiTokenRecords(userId);

    const docs = records.map((record) => ({
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes || [],
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt || null,
      expiresAt: record.expiresAt || null,
      revokedAt: record.revokedAt || null
    }));

    return res.json({ docs, totalDocs: docs.length });
  }

  async createMyApiToken(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const name = String(req.body?.name || '').trim();
    const expiresInDays = Number.parseInt(String(req.body?.expiresInDays || ''), 10);
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes.map((v: any) => String(v || '').trim()).filter(Boolean) : [];

    if (!name) return res.status(400).json({ error: 'Token name is required' });
    if (name.length > 80) return res.status(400).json({ error: 'Token name is too long (max 80 chars)' });
    if (!Number.isNaN(expiresInDays) && (expiresInDays < 1 || expiresInDays > 3650)) {
      return res.status(400).json({ error: 'expiresInDays must be between 1 and 3650' });
    }

    const rawToken = `fct_${randomBytes(24).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const id = randomBytes(8).toString('hex');
    const prefix = rawToken.slice(0, 12);
    const nowIso = new Date().toISOString();
    const expiresAt = Number.isNaN(expiresInDays) ? null : new Date(Date.now() + expiresInDays * 86400000).toISOString();

    const records = await this.readApiTokenRecords(userId);
    const updated: ApiTokenRecord[] = [
      {
        id,
        name,
        hash: tokenHash,
        prefix,
        scopes,
        createdAt: nowIso,
        createdByIp: String(req.ip || ''),
        expiresAt,
        revokedAt: null,
        lastUsedAt: null
      },
      ...records
    ];
    await this.writeApiTokenRecords(userId, updated);
    await this.upsertMeta(this.getApiTokenLookupKey(tokenHash), JSON.stringify({
      userId,
      tokenId: id,
      expiresAt
    }));

    await this.manager.writeLog(
      'INFO',
      `API token created for user ${userId}`,
      'system',
      { userId, tokenId: id, name, scopes, expiresAt }
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      token: rawToken,
      record: {
        id,
        name,
        prefix,
        scopes,
        createdAt: nowIso,
        expiresAt
      }
    });
  }

  async revokeMyApiToken(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const tokenId = String(req.params?.id || '').trim();
    if (!tokenId) return res.status(400).json({ error: 'Token id is required' });

    const records = await this.readApiTokenRecords(userId);
    const idx = records.findIndex((record) => record.id === tokenId);
    if (idx < 0) return res.status(404).json({ error: 'Token not found' });

    const record = records[idx];
    if (!record.revokedAt) {
      record.revokedAt = new Date().toISOString();
      records[idx] = record;
      await this.writeApiTokenRecords(userId, records);
      await this.deleteMeta(this.getApiTokenLookupKey(record.hash));
    }

    await this.manager.writeLog(
      'INFO',
      `API token revoked for user ${userId}`,
      'system',
      { userId, tokenId }
    ).catch(() => {});

    return res.json({ success: true });
  }
}
