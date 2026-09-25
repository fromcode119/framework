import { AuditOutcome } from '@fromcode119/core';
import { TenantBespokePolicies } from '@fromcode119/core';
import { Request, Response } from 'express';
import { ApplicationDomainSettingsUtils, CoercionUtils, RequestContextUtils, SystemConstants, SystemSettingsExposureUtils, TenantMode, TenantResolverService } from '@fromcode119/core';
import { PersonalDataErasureService } from '@fromcode119/core';
import { Logger } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { SystemSettingRegistry } from '@fromcode119/core';
import type { ISettingWrite } from '@fromcode119/core';
import { SystemSettingsWriter } from '@api/controllers/system/system-settings-writer';

/**
 * Reading and writing PLATFORM settings, including which keys a tenant admin may write at all.
 *
 * The writable-key allowlist is the security boundary here: everything not in it is platform-only.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, matching the
 * other system controllers. Composed by SystemController with the same runtime.
 */
export class SystemSettingsController {
  private readonly logger = new Logger({ namespace: 'system-settings' });

  private readonly writer: SystemSettingsWriter;

  constructor(private readonly runtime: SystemControllerRuntime) {
    this.writer = new SystemSettingsWriter(runtime);
  }

  /**
   * The declared, operator-visible system settings. `_system_meta` is a key/value scratch space, not a
   * settings table — returning it raw disclosed the whole `integration_email_profiles` credential blob
   * (SMTP host/user + the password field, ciphertext only for values written since SecretService landed;
   * `SecretService.decrypt` still passes legacy unencrypted values through) plus every user's TOTP secret
   * and recovery codes and the SCIM/API machine tokens. The exposable set is
   * framework-owned (see {@link SystemSettingsExposureUtils}), so nothing new leaks by being written.
   */
  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await this.runtime.db.find(SystemConstants.TABLE.META);
      res.json(SystemSettingsExposureUtils.toExposableSettingsMap(settings, { parseJson: true }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  /**
   * Which settings belong to the PLATFORM, and whether this account may change them.
   *
   * `updateSettings` already refuses a platform key from a site administrator, but the admin cannot
   * render an honest form from a refusal it only learns about after pressing Save — a control that
   * cannot act is a bug. The list comes from `TenantBespokePolicies`, the same definition the RLS
   * policy and the tenant importer read, so the admin never carries a second copy to drift from.
   */
  async platformSettingKeys(req: Request, res: Response) {
    try {
      const tenantMode = TenantMode.isEnabled();
      const editable = !tenantMode || await this.runtime.isPlatformAdmin(req);
      // `tenantMode` so the admin can say WHICH settings are platform-wide even to someone allowed to
      // change them. On a single-tenant deployment there is no second scope to contrast with, so the
      // distinction is noise and the admin shows nothing.
      //
      // `siteSelected` is the OTHER half of the same question, and it was missing: with no site
      // chosen, `updateSettings` below refuses the whole PUT if it carries even one per-site key.
      // Without this fact the admin could not tell which of its fields those were, so it sent them
      // all and nothing saved. Same source as the refusal itself — the request's own tenant.
      const siteSelected = Boolean(RequestContextUtils.getTenantId());
      // `inheritedKeys` is a SUBSET of `keys`, sent alongside rather than carved out of it: the client
      // still needs to know they are platform-owned (to explain what a blank field falls back to), and
      // additionally that this scope may set its own. Carving them out would have made a site's
      // marketplace field look like an ordinary per-site setting with no platform value behind it.
      res.json({
        keys: TenantBespokePolicies.platformKeys(),
        inheritedKeys: SystemSettingRegistry.inheritedKeys(),
        // Per-site keys only a platform admin may write, so the admin can disable those controls for a
        // site admin up front instead of letting the save be refused.
        platformAdminWrittenKeys: [...SystemSettingRegistry.platformAdminWrittenKeys()],
        // What each setting falls back to when the scope has no value — shown as the empty field's
        // placeholder, so a blank box names the value it sends.
        declaredDefaults: SystemSettingRegistry.exposedDefaults(),
        editable,
        tenantMode,
        siteSelected,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  /**
   * Every personal-data dataset, with the strategy currently in force and WHICH layer decided it.
   *
   * Read-only on purpose: the two stored layers are ordinary system settings and are written through
   * the settings PUT below, so there is one write path for every setting on the platform. What this
   * adds is the part a settings map cannot carry — the datasets that exist right now (they are
   * declared at runtime, by core and by whichever plugins this site runs), which strategies each one
   * can honestly honour, and what an unset dataset falls through to. Without it the page would have
   * to guess at any of those, and a guess here is a lie about what an erasure will do.
   */
  async getPersonalDataPolicy(_req: Request, res: Response) {
    try {
      const service = new PersonalDataErasureService(this.runtime.db);
      res.json({ datasets: await service.resolveStrategies() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async updateSettings(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'Settings payload must be an object.' });
      }

      const unknownKeys = Object.keys(payload).filter((k) => !SystemSettingsWriter.writableKeys().has(k));
      if (unknownKeys.length > 0) {
        return res.status(400).json({ error: `Unknown or read-only settings key(s): ${unknownKeys.join(', ')}` });
      }

      const preparedPayload = await this.prepareSettingsPayload(payload as Record<string, unknown>);

      // The audit window has a FLOOR, and it is refused here rather than clamped. `packages/ai`
      // declares `_system_audit_logs` the EU AI Act Art. 12 record-keeping store, so a window shorter
      // than the six months that record is expected to survive would let the platform quietly break a
      // commitment its own code makes. Silently storing 180 when the operator asked for 30 would be
      // worse than refusing: they would believe they had 30. Keeping forever (empty) stays allowed.
      const auditFloor = SystemSettingsWriter.auditWindowBelowFloor(preparedPayload);
      if (auditFloor !== null) {
        return res.status(400).json({
          error: 'audit_retention_below_minimum',
          message: `The audit trail must be kept for at least ${SystemConstants.AUDIT_RETENTION_MIN_DAYS} days —`
            + ` ${auditFloor} is too short. It records security denials, settings changes and AI invocations,`
            + ' and is this platform\'s EU AI Act record. Leave it empty to keep the audit trail forever.',
          key: SystemConstants.META_KEY.AUDIT_RETENTION_DAYS,
          minimumDays: SystemConstants.AUDIT_RETENTION_MIN_DAYS,
        });
      }
      const timestamp = new Date();

      const actor = (req as any).user || {};
      // A PLATFORM key (deployment truths: URLs, maintenance, render and isolation limits) belongs to
      // the platform row, whichever site the admin happens to have selected. Writing it under the
      // request's tenant made the setting per-site by accident: that site read it, every other site
      // saw the default. Only a platform admin may write that row — and on a multi-site platform a
      // site admin may not write it AT ALL: a site row of a platform key is read by nothing, so
      // accepting it would be a control that silently does nothing. Refused, with the reason.
      // INHERITED keys carry a platform row AND a per-site one, so they are platform keys to the
      // database and site keys to this screen. Everything below turns on the difference: a site row of
      // one is read (by the site that wrote it), which is exactly what made a site row of a PLATFORM
      // key worth refusing.
      const inheritedKeys = new Set(SystemSettingRegistry.inheritedKeys());
      const platformKeys = new Set(TenantBespokePolicies.platformKeys());
      const platformOnlyKeys = new Set([...platformKeys].filter((key) => !inheritedKeys.has(key)));
      const tenantBound = Boolean(RequestContextUtils.getTenantId());
      const platformAdmin = await this.runtime.isPlatformAdmin(req);
      // A site key the PLATFORM decides for each site (sending through the platform's mail server):
      // the row is the site's, but the thing it spends is the platform's, so a site admin may not grant it.
      const platformGranted = SystemSettingRegistry.platformAdminWrittenKeys();
      const refused = Object.keys(preparedPayload).filter((key) => platformOnlyKeys.has(key) || platformGranted.has(key));
      if (refused.length > 0 && TenantMode.isEnabled() && !platformAdmin) {
        return res.status(403).json({ error: 'platform_admin_required', message: `Platform setting(s) ${refused.join(', ')} apply to every site and only a platform admin may change them.`, keys: refused });
      }
      // A PER-SITE key needs a site. With none selected on a multi-site platform there is no row it
      // could belong to: the `_system_meta` policy accepts a tenant-less row only from a platform
      // write, so the insert is refused by the database and the whole save 500s — naming no key and
      // logging nothing. Refused here instead, saying which keys and what to do, because a control
      // that appears to save and cannot is exactly the magic this codebase forbids.
      const siteless = TenantMode.isEnabled() && !RequestContextUtils.getTenantId();
      // An INHERITED key is NOT siteless-refused: with no site selected it is simply the platform's
      // own value being edited, which is the row it lands in below.
      const perSite = Object.keys(preparedPayload).filter((key) => !platformKeys.has(key));
      if (siteless && perSite.length > 0) {
        return res.status(400).json({
          error: 'site_required',
          message: `Setting(s) ${perSite.join(', ')} belong to a site. Choose a site first — with none selected only platform settings can be changed.`,
          keys: perSite,
        });
      }

      // A WORKSPACE's appearance is carried by its kind (T6 §3.3): no setting exists for it, so a
      // write is refused rather than stored where nothing reads it.
      if (SystemConstants.META_KEY.ADMIN_APPEARANCE in preparedPayload && TenantMode.isEnabled()) {
        const tenantId = RequestContextUtils.getTenantId();
        const tenant = tenantId ? await TenantResolverService.shared(this.runtime.db).resolveById(tenantId) : null;
        if (tenant?.isWorkspace) {
          return res.status(403).json({ error: 'kind_locks_appearance', message: `"${tenant.slug}" is a workspace: its console is locked to "${tenant.appearance || 'default'}" by its kind.` });
        }
      }
      const asPlatform = platformAdmin && this.runtime.db.dialect === 'postgres';
      const writes: ISettingWrite[] = [];
      for (const [key, value] of Object.entries(preparedPayload)) {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        let previousValue: string | undefined;
        // The platform row for a platform-only key wherever the admin is standing, and for an
        // INHERITED key only when no site is selected. Inside a site an INHERITED key falls through to
        // the tenant-scoped write below, which lands in THAT site's row — the override itself.
        const writesPlatformRow = platformOnlyKeys.has(key) || (inheritedKeys.has(key) && !tenantBound);
        if (asPlatform && writesPlatformRow) {
          previousValue = await this.writer.writePlatformSetting(key, serializedValue, timestamp);
          writes.push({ key, tenantId: null });
        } else {
          // Address THIS SCOPE'S row, not merely the key.
          //
          // `findOne` by key alone was safe only while a tenant could see one row per key. The policy
          // publishes the platform's `tenant_id IS NULL` row to every tenant for the keys on its
          // allowlist, so inside a site that lookup can return the PLATFORM's row — and updating it
          // is refused by `WITH CHECK` with `new row violates row-level security policy`, naming
          // neither the key nor the reason. Matching on tenancy as well as key is what makes a site's
          // save land in the site's own row. An INSERT needs no tenant of its own: the column defaults
          // to the session's.
          const scopeOf = (row: any): string | null => row?.tenant_id ?? null;
          const currentScope = RequestContextUtils.getTenantId() ?? null;
          const candidates = await this.runtime.db.find(SystemConstants.TABLE.META, { where: { key } });
          const existing = (Array.isArray(candidates) ? candidates : [])
            .find((row: any) => scopeOf(row) === currentScope);
          previousValue = existing ? String((existing as any).value ?? '') : undefined;
          if (existing) {
            await this.runtime.db.update(
              SystemConstants.TABLE.META,
              currentScope === null ? { key } : { key, tenant_id: currentScope },
              { value: serializedValue, updated_at: timestamp },
            );
          } else {
            await this.runtime.db.insert(SystemConstants.TABLE.META, { key, value: serializedValue, updated_at: timestamp });
          }
          writes.push({ key, tenantId: currentScope });
        }

        // Audit every setting change WITH the actor + old→new. This is what finally attributes
        // "who flipped admin_appearance" — and every other settings mystery — to a person.
        if (previousValue !== serializedValue) {
          void this.runtime.manager.audit.logAction('system', 'settings.update', key, AuditOutcome.ALLOWED, {
            userId: actor.id, email: actor.email, from: previousValue ?? null, to: serializedValue,
          });
        }
      }

      // Announce the settings change so in-process caches (e.g. the route-resolution
      // permalink-structure cache) can invalidate immediately instead of waiting out a TTL.
      // `writes` says which row each key landed in, so every cache that derived a value from one
      // (`SettingChangeInvalidators`) drops exactly the copies the save made stale — on every api
      // instance, since the hook is broadcast.
      this.runtime.manager.hooks.emit('system:settings:updated', { keys: Object.keys(preparedPayload), writes });

      res.json({ success: true });
    } catch (error: any) {
      // LOGGED. This catch was silent, so a settings save the database refused left a 500 in the
      // browser and NOTHING on the server — the cause could only be found by replaying the request.
      this.logger.error(`Failed to update settings: ${error?.message ?? error}`, error);
      res.status(500).json({ error: error.message });
    }
  }


  /** @see SystemSettingsWriter.prepareSettingsPayload */
  private prepareSettingsPayload(...args: Parameters<SystemSettingsWriter["prepareSettingsPayload"]>): ReturnType<SystemSettingsWriter["prepareSettingsPayload"]> {
    return this.writer.prepareSettingsPayload(...args);
  }

}
