import { Request, Response } from 'express';
import { SystemMetaKey } from '@fromcode119/sdk/internal';
import { 
  PluginManager, 
  ThemeManager, 
  SystemUpdateService, 
  parseBoolean,
  SystemTable
} from '@fromcode119/core';
import { RESTController } from './rest-controller';
import { ShortcodeService } from '../services/shortcode-service';
import { SystemService } from '../services/system-service';
import { UserManagementService } from '../services/user-management-service';
import { ResolutionService } from '../services/resolution-service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { users } from '@fromcode119/database';
import { hashRecoveryCode, normalizeEmail } from '../utils/auth';

export class SystemController {
  private db: any;
  private shortcodes: ShortcodeService;
  private system: SystemService;
  private users: UserManagementService;
  private resolution: ResolutionService;

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    const dbWrapper = (manager as any).db;
    this.db = dbWrapper.drizzle;
    this.shortcodes = new ShortcodeService(manager, restController);
    this.system = new SystemService(dbWrapper, this.db);
    this.users = new UserManagementService(dbWrapper, manager.auth, manager);
    this.resolution = new ResolutionService(manager, restController);
  }

  async getAdminMetadata(req: Request, res: Response) {
    try {
      const metadata = this.manager.getAdminMetadata() as any;
      const runtimeModules = this.manager.getRuntimeModules();
      const frontendMeta = await this.themeManager.getFrontendMetadata(runtimeModules);

      if (frontendMeta?.activeTheme) {
        metadata.activeTheme = { ...frontendMeta.activeTheme, ui: { ...(frontendMeta.activeTheme.ui || {}), css: [] } };
      }
      if (frontendMeta?.runtimeModules) metadata.runtimeModules = frontendMeta.runtimeModules;

      const settings = await (this.manager as any).db.find(SystemTable.META);
      const settingsMap: Record<string, any> = {};
      settings.forEach((s: any) => settingsMap[s.key] = s.value);
      metadata.settings = settingsMap;

      res.json(metadata);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getIntegrations(req: Request, res: Response) {
    try {
      const data = await this.manager.integrations.listConfigs();
      res.json({ docs: data, totalDocs: data.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getIntegration(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const integration = await this.manager.integrations.getConfig(type);
      if (!integration) return res.status(404).json({ error: 'Not found' });
      res.json(integration);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async updateIntegration(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const { provider, config, profileId, profileName, makeActive, enabled, providerId, providerName } = req.body;
      const updated = await (this.manager.integrations as any).updateConfig(type, provider, config || {}, {
        profileId,
        profileName,
        providerId,
        providerName,
        makeActive: makeActive === undefined ? true : parseBoolean(makeActive),
        enabled: enabled === undefined ? undefined : parseBoolean(enabled)
      });
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async setIntegrationProviderEnabled(req: Request, res: Response) {
    try {
      const { type, providerId } = req.params;
      const enabled = parseBoolean(req.body?.enabled);
      const updated = await (this.manager.integrations as any).setProviderEnabled(type, providerId, enabled);
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async removeIntegrationProvider(req: Request, res: Response) {
    try {
      const { type, providerId } = req.params;
      const updated = await (this.manager.integrations as any).removeProvider(type, providerId);
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async activateIntegrationProfile(req: Request, res: Response) {
    try {
      const { type, profileId } = req.params;
      const updated = await (this.manager.integrations as any).activateProfile(type, profileId);
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async renameIntegrationProfile(req: Request, res: Response) {
    try {
      const { type, profileId } = req.params;
      const profileName = String(req.body?.profileName || req.body?.name || '').trim();
      if (!profileName) {
        return res.status(400).json({ error: 'profileName is required' });
      }
      const updated = await (this.manager.integrations as any).renameProfile(type, profileId, profileName);
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async deleteIntegrationProfile(req: Request, res: Response) {
    try {
      const { type, profileId } = req.params;
      const updated = await (this.manager.integrations as any).deleteProfile(type, profileId);
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getFrontendMetadata(req: Request, res: Response) {
    const metadata = await this.themeManager.getFrontendMetadata(this.manager.getRuntimeModules());
    const activePlugins = this.manager.getSortedPlugins(
      this.manager.getPlugins().filter((p: any) => p.state === 'active')
    ).map((p: any) => ({
      slug: p.manifest.slug,
      version: p.manifest.version,
      name: p.manifest.name,
      capabilities: p.manifest.capabilities,
      ui: {
        ...(p.manifest.ui || {}),
        headInjections: this.manager.getHeadInjections(p.manifest.slug)
      }
    }));

    res.json({
      ...metadata,
      plugins: activePlugins
    });
  }

  async getThemes(req: Request, res: Response) {
    res.json(this.themeManager.getThemes());
  }

  async activateTheme(req: Request, res: Response) {
    try {
      await this.themeManager.activateTheme(req.body.slug);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getStats(req: Request, res: Response) {
    const stats = await Promise.all(this.manager.getCollections().map(async (c) => {
      try {
        return {
          slug: c.slug,
          shortSlug: c.shortSlug || c.slug,
          count: await (this.manager as any).db.count(c.tableName || c.slug),
          system: !!c.system,
          hidden: !!c.admin?.hidden,
          icon: c.admin?.icon,
          priority: c.admin?.priority || c.priority || 100,
          pluginSlug: c.pluginSlug || 'system'
        };
      } catch {
        return { slug: c.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getSecurityStats(req: Request, res: Response) {
    try {
      res.json(await this.manager.getSecuritySummary());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getActivity(req: Request, res: Response) {
    return this.restController.getGlobalActivity(this.manager.getCollections(), req, res);
  }

  async getShortcodes(req: Request, res: Response) {
    const docs = await this.shortcodes.getRegisteredShortcodes();
    res.json({ docs, totalDocs: docs.length });
  }

  async renderShortcodes(req: Request, res: Response) {
    try {
      const { content, maxShortcodes } = req.body;
      const result = await this.shortcodes.render(content, { user: (req as any).user, maxShortcodes });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      res.json(await this.system.getLogs({
        page: parseInt(req.query.page as string),
        limit: parseInt(req.query.limit as string),
        search: req.query.search as string
      }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      res.json(await this.system.getAuditLogs({
        page: parseInt(req.query.page as string),
        limit: parseInt(req.query.limit as string),
        search: req.query.search as string,
        status: req.query.status as string
      }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getRoles(req: Request, res: Response) {
    try {
      res.json(await this.users.getRoles());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveRole(req: Request, res: Response) {
    try {
      await this.users.saveRole(req.params.slug || req.body.slug, req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getRole(req: Request, res: Response) {
    try {
      const role = await this.users.getRole(req.params.slug);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      res.json(role);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async deleteRole(req: Request, res: Response) {
    try {
      await this.users.deleteRole(req.params.slug);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      res.json(await this.users.getPermissions());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async savePermission(req: Request, res: Response) {
    try {
      await this.users.savePermission(req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      const docs = await this.users.getUsers();
      res.json({ docs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveUser(req: Request, res: Response) {
    try {
      const id = await this.users.saveUser(req.params.id ? parseInt(req.params.id) : null, req.body);
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
      const user = await this.users.getUser(id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
      await this.users.deleteUser(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveUserRoles(req: Request, res: Response) {
    try {
      const userId = parseInt(String(req.body?.userId || req.params?.id || ''), 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
      await this.users.saveUserRoles(userId, roles);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async checkUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.checkUpdate());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async applyUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.applyUpdate());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getDataSources(req: Request, res: Response) {
    try {
      const docs = this.manager.getCollections().map((collection) => ({
        slug: collection.slug,
        shortSlug: collection.shortSlug || collection.slug,
        label: (collection as any).label || collection.slug,
        hidden: !!collection.admin?.hidden
      }));
      res.json({ docs, totalDocs: docs.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async queryDataSource(req: Request, res: Response) {
    try {
      const source = String(req.query.source || req.body?.source || req.query.slug || req.body?.slug || '').trim();
      if (!source) return res.status(400).json({ error: 'source is required' });

      const collection = this.manager.getCollections().find((c: any) => {
        return c.slug === source || c.shortSlug === source || c.unprefixedSlug === source;
      });
      if (!collection) return res.status(404).json({ error: `Unknown data source: ${source}` });

      const mergedQuery = { ...(req.query as any), ...(req.body || {}) } as any;
      delete mergedQuery.source;
      const data = await this.restController.find(collection, {
        query: mergedQuery,
        user: (req as any).user,
        locale: (req as any).locale,
        headers: req.headers,
        cookies: (req as any).cookies
      });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getI18n(req: Request, res: Response) {
    const locale = (req.query.locale as string) || 'en';
    const activeSlugs = new Set(this.manager.getPlugins().filter(p => p.state === 'active').map(p => p.manifest.slug));
    const translations = (this.manager as any).i18n.translations.get(locale) || {};
    const filtered: any = {};
    for (const [slug, data] of Object.entries(translations)) {
      if (activeSlugs.has(slug)) filtered[slug] = data;
    }
    res.json(filtered);
  }

  async resolveSlug(req: Request, res: Response) {
    try {
      const slug = req.query.slug as string;
      if (!slug) return res.status(400).json({ error: 'Slug is required' });

      const isAdmin = (req as any).user?.roles?.includes('admin');
      const isPreview = parseBoolean(req.query.preview) || parseBoolean(req.query.draft);
      
      const result = await this.resolution.resolveSlug(slug, {
        user: (req as any).user,
        preview: isAdmin || isPreview,
        locale: req.query.locale as string,
        fallback_locale: req.query.fallback_locale as string,
        locale_mode: req.query.locale_mode as string
      });

      if (!result) return res.status(404).json({ error: 'Not found' });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getEvents(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    const handler = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    this.manager.hooks.on('system:hmr:reload', handler);
    const hb = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    req.on('close', () => {
      clearInterval(hb);
      this.manager.hooks.off('system:hmr:reload', handler);
    });
  }

  async sendTestTelemetryEmail(req: Request, res: Response) {
    try {
      const user = ((req as any).user || {}) as { id?: string | number; email?: string; roles?: string[] };
      const result = await (this.manager as any).sendTestEmailTelemetry({
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.roles) ? user.roles : []
      });
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'Failed to send telemetry test email' });
    }
  }

  async getTwoFactorStatus(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

      const db = (this.manager as any).db;
      const enabledRow = await db.findOne(SystemTable.META, { key: `user:${userId}:2fa_enabled` });
      const recoveryCodes = await this.readRecoveryCodeRecords(userId);
      
      res.json({
        enabled: enabledRow?.value === 'true',
        recoveryCodesRemaining: recoveryCodes.filter((entry) => !entry.usedAt).length
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async setup2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

      const user = await this.users.getUser(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Generate a new secret
      const secret = speakeasy.generateSecret({
        name: `Fromcode (${user.email})`,
        length: 32
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Store the secret temporarily (will be confirmed during verification)
      const db = (this.manager as any).db;
      const existingSecret = await db.findOne(SystemTable.META, { key: `user:${userId}:totp_secret_pending` });
      
      if (existingSecret) {
        await db.update(SystemTable.META, 
          { key: `user:${userId}:totp_secret_pending` },
          { value: secret.base32 }
        );
      } else {
        await db.insert(SystemTable.META, {
          key: `user:${userId}:totp_secret_pending`,
          value: secret.base32
        });
      }

      res.json({
        secret: secret.base32,
        qrCode
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async verify2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const db = (this.manager as any).db;
      const secretRow = await db.findOne(SystemTable.META, { key: `user:${userId}:totp_secret_pending` });
      
      if (!secretRow) {
        return res.status(400).json({ error: '2FA setup not initiated. Please start setup first.' });
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: secretRow.value,
        encoding: 'base32',
        token,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      // Move secret from pending to active
      const existingTOTPSecret = await db.findOne(SystemTable.META, { key: `user:${userId}:totp_secret` });
      if (existingTOTPSecret) {
        await db.update(SystemTable.META,
          { key: `user:${userId}:totp_secret` },
          { value: secretRow.value }
        );
      } else {
        await db.insert(SystemTable.META, {
          key: `user:${userId}:totp_secret`,
          value: secretRow.value
        });
      }
      
      const existing2FAEnabled = await db.findOne(SystemTable.META, { key: `user:${userId}:2fa_enabled` });
      if (existing2FAEnabled) {
        await db.update(SystemTable.META,
          { key: `user:${userId}:2fa_enabled` },
          { value: 'true' }
        );
      } else {
        await db.insert(SystemTable.META, {
          key: `user:${userId}:2fa_enabled`,
          value: 'true'
        });
      }

      // Generate one-time recovery codes
      const recoveryCodes = this.generateRecoveryCodes();
      const recoveryRecords = recoveryCodes.map((code) => ({
        hash: this.hashRecoveryCode(code),
        usedAt: null as string | null,
        createdAt: new Date().toISOString()
      }));
      await this.writeRecoveryCodeRecords(userId, recoveryRecords);

      // Clean up pending secret
      await db.delete(SystemTable.META, { key: `user:${userId}:totp_secret_pending` });

      await this.sendSecurityNotification({
        userId,
        subject: 'Two-factor authentication enabled',
        title: 'Two-factor authentication has been enabled on your account.',
        details: [`Time: ${new Date().toISOString()}`]
      });

      res.json({
        success: true,
        message: '2FA enabled successfully',
        recoveryCodes
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async regenerateRecoveryCodes(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

      const db = (this.manager as any).db;
      const enabledRow = await db.findOne(SystemTable.META, { key: `user:${userId}:2fa_enabled` });
      if (enabledRow?.value !== 'true') {
        return res.status(400).json({ error: '2FA must be enabled before recovery codes can be generated.' });
      }

      const recoveryCodes = this.generateRecoveryCodes();
      const recoveryRecords = recoveryCodes.map((code) => ({
        hash: this.hashRecoveryCode(code),
        usedAt: null as string | null,
        createdAt: new Date().toISOString()
      }));

      await this.writeRecoveryCodeRecords(userId, recoveryRecords);

      res.json({
        success: true,
        recoveryCodes
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async disable2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

      const db = (this.manager as any).db;
      
      // Remove all 2FA related metadata
      await db.delete(SystemTable.META, { key: `user:${userId}:2fa_enabled` });
      await db.delete(SystemTable.META, { key: `user:${userId}:totp_secret` });
      await db.delete(SystemTable.META, { key: `user:${userId}:totp_secret_pending` });
      await db.delete(SystemTable.META, { key: this.getRecoveryCodesKey(userId) });

      await this.sendSecurityNotification({
        userId,
        subject: 'Two-factor authentication disabled',
        title: 'Two-factor authentication has been disabled on your account.',
        details: [`Time: ${new Date().toISOString()}`]
      });

      res.json({ success: true, message: '2FA disabled successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  private getRecoveryCodesKey(userId: number) {
    return `user:${userId}:2fa_recovery_codes`;
  }

  private generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    while (codes.length < count) {
      const raw = randomBytes(5).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
      if (!codes.includes(formatted)) {
        codes.push(formatted);
      }
    }
    return codes;
  }

  private hashRecoveryCode(code: string): string {
    return hashRecoveryCode(code);
  }

  private async readRecoveryCodeRecords(userId: number): Promise<Array<{ hash: string; usedAt: string | null; createdAt?: string }>> {
    const db = (this.manager as any).db;
    const row = await db.findOne(SystemTable.META, { key: this.getRecoveryCodesKey(userId) });
    const raw = String(row?.value || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => ({
          hash: String(entry?.hash || '').trim(),
          usedAt: entry?.usedAt ? String(entry.usedAt) : null,
          createdAt: entry?.createdAt ? String(entry.createdAt) : undefined
        }))
        .filter((entry) => !!entry.hash);
    } catch {
      return [];
    }
  }

  private async writeRecoveryCodeRecords(
    userId: number,
    records: Array<{ hash: string; usedAt: string | null; createdAt?: string }>
  ) {
    const db = (this.manager as any).db;
    const key = this.getRecoveryCodesKey(userId);
    const existing = await db.findOne(SystemTable.META, { key });
    const value = JSON.stringify(records);

    if (existing) {
      await db.update(SystemTable.META, { key }, { value });
      return;
    }

    await db.insert(SystemTable.META, { key, value });
  }

  private async sendSecurityNotification(options: {
    userId: number;
    subject: string;
    title: string;
    details?: string[];
  }) {
    try {
      const db = (this.manager as any).db;
      const enabled = await db.findOne(SystemTable.META, { key: SystemMetaKey.AUTH_SECURITY_NOTIFICATIONS });
      if (String(enabled?.value || 'true').trim().toLowerCase() !== 'true') {
        return;
      }

      const user = await db.findOne(users, { id: options.userId });
      const recipient = this.normalizeEmail(user?.email);
      if (!recipient) return;

      const appName = process.env.APP_NAME || 'Fromcode';
      const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@fromcode.com';
      const details = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
      const text = `${options.title}\n\n${details.join('\n')}`;
      const html = `<p>${options.title}</p>${details.length > 0 ? `<ul>${details.map((line) => `<li>${line}</li>`).join('')}</ul>` : ''}`;

      await this.manager.email.send({
        to: recipient,
        from: fromAddress,
        subject: `${appName}: ${options.subject}`,
        text,
        html
      });
    } catch {
      // Security notifications are best-effort.
    }
  }

  private normalizeEmail(email: any): string {
    return normalizeEmail(email);
  }
}
