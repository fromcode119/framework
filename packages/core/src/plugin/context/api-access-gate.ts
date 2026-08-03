import type { NextFunction, Request, Response } from 'express';
import { EnvUtils } from '@core/utils/env-utils';
import { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import type { IApiAccessDescriptor } from '@core/plugin/context/interfaces/api-access-descriptor.interface';
import type { IApiPermissionCheck } from '@core/plugin/context/interfaces/api-permission-check.interface';
import { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';

/**
 * Central fail-closed authorization gate for plugin API routes.
 *
 * Every plugin route registers through `ApiContextProxy`, which asks this gate for a guard middleware.
 * A route DECLARES its access by passing an `{ access }` descriptor as the first argument
 * (`context.api.get('/x', { access: AccessLevel.PUBLIC }, handler)`). The levels:
 * The levels are {@link AccessLevel} members; a specific permission is an
 * {@link ApiPermissionRequirement} (admins always pass).
 * An UNDECLARED route defaults to **admin-only** — so forgetting to declare fails closed, never open.
 *
 * Enforcement is OFF unless `ENFORCE_AUTHZ_GATEWAY=true`, so the gate is completely inert until every
 * route has been tagged and the flag is flipped (staged rollout). When OFF, `build()` returns null and
 * route registration is byte-for-byte unchanged.
 */
export class ApiAccessGate {
  private static permissionCheck: IApiPermissionCheck | null = null;

  /** Wired by the auth layer at boot so the gate can enforce fine-grained permissions. */
  static setPermissionChecker(fn: IApiPermissionCheck): void {
    ApiAccessGate.permissionCheck = fn;
  }

  static enabled(): boolean {
    return EnvUtils.flag('ENFORCE_AUTHZ_GATEWAY');
  }

  static isDescriptor(value: unknown): value is IApiAccessDescriptor {
    return !!value && typeof value === 'object' && !Array.isArray(value) && 'access' in value;
  }

  /**
   * Build the gate middleware for a route's declared access. Returns null when enforcement is disabled
   * (inert) so the caller registers the route exactly as before.
   */
  static build(access: AccessLevel | ApiPermissionRequirement | undefined): ((req: Request, res: Response, next: NextFunction) => void) | null {
    if (!ApiAccessGate.enabled()) return null;
    return (req: Request, res: Response, next: NextFunction): void => {
      void ApiAccessGate.evaluate(access, req, res, next);
    };
  }

  private static async evaluate(
    access: AccessLevel | ApiPermissionRequirement | undefined,
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    // The gate governs ONLY plugin routes (mounted under /…/plugins/<slug>/…). The core BaseRouter is
    // also extended by FRAMEWORK routers (system, collections, auth, media) which are mounted elsewhere
    // and keep their own guards (requirePermission / collection policy / role guard) — they must never be
    // caught here, or public system routes like /system/resolve would wrongly become admin-only.
    const url = String((req as unknown as { originalUrl?: string; baseUrl?: string }).originalUrl
      || (req as unknown as { baseUrl?: string }).baseUrl || '');
    if (!url.includes('/plugins/')) return next();

    // Framework-served UI ASSET routes (`/plugins/<slug>/ui/*`, `/themes/<slug>/ui/*`) are PUBLIC static
    // plugin/theme code (bundle.js, frontend.js, css), NOT plugin data endpoints. They sit under /plugins/
    // but are served by the framework's asset router, so they must be excluded here — otherwise the storefront's
    // plugin bundles 401 for anonymous visitors and every client-side plugin feature (cart, banners) breaks.
    if (/\/(?:plugins|themes)\/[^/]+\/ui\//.test(url)) return next();

    const level: AccessLevel | ApiPermissionRequirement = access ?? AccessLevel.ADMIN;
    if (level === AccessLevel.PUBLIC) return next();

    const user = (req as unknown as { user?: { id?: unknown; userId?: unknown; roles?: unknown } }).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (level === AccessLevel.AUTHENTICATED || level === AccessLevel.SELF) return next();

    const roles = Array.isArray(user.roles) ? (user.roles as string[]) : [];
    if (roles.includes(AccessLevel.ADMIN.value)) return next();

    // Resolve the permission to check. An explicit `{ permission }` declaration wins; otherwise an
    // UNDECLARED admin route derives a per-plugin permission `<slug>:manage` from the route path, so a
    // scoped operator role (e.g. `mlm:*`, `cms:*`) grants that plugin's admin routes without tagging each
    // one. `<slug>:*` matches `<slug>:manage` via the checker's hierarchical wildcard.
    let permission: string | null = null;
    if (level instanceof ApiPermissionRequirement) {
      permission = level.permission;
    } else if (level === AccessLevel.ADMIN) {
      const match = url.match(/\/plugins\/([^/?]+)/);
      permission = match ? `${match[1]}:manage` : null;
    }

    if (permission && ApiAccessGate.permissionCheck) {
      try {
        const userId = Number(user.id ?? user.userId);
        if (userId && (await ApiAccessGate.permissionCheck(userId, permission))) return next();
      } catch {
        // fall through to deny
      }
    }
    res.status(403).json({ error: 'Forbidden' });
  }
}
