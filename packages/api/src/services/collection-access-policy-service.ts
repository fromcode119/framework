import { WriteOperation } from '@api/services/enums/write-operation.enum';
import { ReadConstraintOperators } from '@api/services/read-constraint-operators';
import { ICollection, EnvUtils, PermissionGrants, PermissionNames, CollectionPermissionAction, ContentPreviewAccessUtils } from '@fromcode119/core';

export class CollectionAccessPolicyService {
  /**
   * Resolves the permissions a set of roles carries. Wired once by the auth layer at boot, exactly as
   * the plugin-route gate is; unwired, no role is granted anything here (fail closed).
   */
  private static permissionResolver: ((roles: string[]) => Promise<string[]>) | null = null;

  /** One lookup per request, however many collections it touches. */
  private static readonly requestPermissions = new WeakMap<object, Promise<string[]>>();

  static setPermissionResolver(resolver: (roles: string[]) => Promise<string[]>): void {
    CollectionAccessPolicyService.permissionResolver = resolver;
  }

  async resolveReadConstraints(collection: ICollection, req: any): Promise<Record<string, unknown>> {
    // A role GRANTED reading this collection reads all of it, the way an administrator does. Asked
    // before the collection's own rule, which is written for everyone else: its row scoping ("your
    // own records") and its explicit denies are what a user without the grant gets.
    if (await this.isGranted(collection, req, CollectionPermissionAction.READ)) {
      return {};
    }

    const accessResult = await this.evaluateAccess(collection.access?.read, req);
    if (accessResult === true) {
      return {};
    }

    if (this.isConstraint(accessResult)) {
      return accessResult;
    }

    // An EXPLICIT deny from a declared access.read always gates (admins bypass, same as mutations).
    // Collections holding secrets/PII declare `access.read` returning false for non-admins; that
    // declaration must hold unconditionally. The ENFORCE_COLLECTION_READ_AUTHZ flag below covers
    // only the UNDECLARED (null) case, which stays opt-in because anonymous content resolution
    // still reads untagged collections.
    if (accessResult === false) {
      if (this.isAdmin(req?.user)) {
        return {};
      }
      this.throwAuthError(req, `Read access to collection "${collection.slug}" requires permission.`);
    }

    if (collection.system) {
      if (this.isAdmin(req?.user)) {
        return {};
      }

      this.throwAuthError(req, `Authentication is required to read system collection "${collection.slug}".`);
    }

    // Fail-closed (flag-gated): a non-system collection whose read access is undeclared (no access.read)
    // is admin-only when enforced (explicit denies are handled unconditionally above). Public/content collections opt in with
    // `access.read` returning true (or a row-scoping constraint). This uses its OWN flag
    // (ENFORCE_COLLECTION_READ_AUTHZ), SEPARATE from the route gateway, because server-side content
    // resolution reads content collections (pages/posts, products) anonymously — so this must stay
    // off until those collections are tagged with `access.read`. Inert by default.
    if (EnvUtils.flag('ENFORCE_COLLECTION_READ_AUTHZ') && accessResult === null) {
      if (this.isAdmin(req?.user)) {
        return {};
      }
      this.throwAuthError(req, `Read access to collection "${collection.slug}" requires permission.`);
    }

    return {};
  }

  async ensureCreateAllowed(collection: ICollection, req: any): Promise<void> {
    await this.ensureMutationAllowed(collection, req, WriteOperation.CREATE);
  }

  async ensureUpdateAllowed(collection: ICollection, req: any): Promise<void> {
    await this.ensureMutationAllowed(collection, req, WriteOperation.UPDATE);
  }

  async ensureDeleteAllowed(collection: ICollection, req: any): Promise<void> {
    await this.ensureMutationAllowed(collection, req, WriteOperation.DELETE);
  }

  matchesReadConstraints(record: Record<string, unknown> | null, constraints: Record<string, unknown>): boolean {
    if (!record) {
      return false;
    }

    for (const [key, expectedValue] of Object.entries(constraints)) {
      if (ReadConstraintOperators.isOperator(expectedValue)) {
        if (!ReadConstraintOperators.matches(record[key], expectedValue)) return false;
        continue;
      }
      if (record[key] !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  private async ensureMutationAllowed(
    collection: ICollection,
    req: any,
    action: WriteOperation,
  ): Promise<void> {
    // A collection that DISABLES an operation in `api: { create/update/delete }` is stating a
    // structural fact about itself, not a permission — so it holds for everyone, admins included.
    // These flags were stored at registration and consulted NOWHERE, which made every
    // `api: { create: false }` a decorative promise: an append-only audit log was fully editable and
    // deletable through the REST API by anyone who could reach it.
    if (this.isOperationDisabled(collection, action)) {
      this.throwOperationDisabled(collection, action);
    }

    // The write operations and the collection actions share their names (`create`, `update`, `delete`).
    const granted = CollectionPermissionAction.fromValue(action.value) as CollectionPermissionAction | undefined;
    if (granted && await this.isGranted(collection, req, granted)) {
      return;
    }

    const accessResult = await this.evaluateAccess(collection.access?.[action.value], req);
    if (accessResult === true || this.isConstraint(accessResult)) {
      return;
    }

    if (this.isAdmin(req?.user)) {
      return;
    }

    this.throwAuthError(req, `Authentication is required to ${action} collection "${collection.slug}".`);
  }

  private async evaluateAccess(access: unknown, req: any): Promise<boolean | Record<string, unknown> | null> {
    // A declared constant: the answer for every request, without calling a plugin's process to get it.
    if (access === true || access === false) {
      return access;
    }
    if (typeof access !== 'function') {
      return null;
    }

    const result = await access({ req, user: req?.user || null });
    if (result === true || result === false) {
      return result;
    }

    if (this.isConstraint(result)) {
      return result;
    }

    return Boolean(result);
  }

  /**
   * May this request see every record of the collection, unpublished ones included? An administrator
   * (or anyone the preview rule admits) may, and so may a role GRANTED reading the collection: the
   * `status = published` default exists to keep drafts off the storefront, and applied to a clerk given
   * Orders it hid every order, because an order is never "published".
   */
  async seesUnpublished(collection: ICollection, req: any): Promise<boolean> {
    return ContentPreviewAccessUtils.canPreviewUnpublished(req?.user)
      || this.isGranted(collection, req, CollectionPermissionAction.READ);
  }

  /**
   * Does this request read the WHOLE collection — every field of every record — the way an
   * administrator does? A role granted reading the collection does too. Everyone else is a partial
   * reader: the collection's `staffOnly` and `withheldWhen` fields are held back from them.
   */
  async readsEverything(collection: ICollection, req: any): Promise<boolean> {
    return this.isAdmin(req?.user) || this.isGranted(collection, req, CollectionPermissionAction.READ);
  }

  /**
   * The console's own read tools — export and value suggestions — are for those who read the whole
   * collection. They return raw columns across every record, so offered to anyone who may merely
   * browse a public collection they handed out drafts and stored passwords wholesale.
   */
  async ensureReadsEverything(collection: ICollection, req: any): Promise<void> {
    if (await this.readsEverything(collection, req)) return;
    this.throwAuthError(req, `Reading every record of "${collection.slug}" requires permission.`);
  }

  /**
   * Does a role in effect for this request hold `<plugin>:<collection>:<action>` (or a wildcard over
   * it)? Only a plugin's collections are grantable this way. A SYSTEM collection (users, media,
   * settings…) is governed by the framework's own permissions on its own routes, and a collection
   * with no owning plugin has no name a role could hold.
   */
  private async isGranted(collection: ICollection, req: any, action: CollectionPermissionAction): Promise<boolean> {
    const pluginSlug = String(collection.pluginSlug ?? '').trim();
    if (!pluginSlug || collection.system || !req?.user) return false;
    const permissions = await this.permissionsOf(req);
    return PermissionGrants.covers(permissions, PermissionNames.collection(pluginSlug, PermissionNames.collectionKey(collection), action));
  }

  private permissionsOf(req: any): Promise<string[]> {
    const resolver = CollectionAccessPolicyService.permissionResolver;
    if (!resolver) return Promise.resolve([]);
    let pending = CollectionAccessPolicyService.requestPermissions.get(req);
    if (!pending) {
      const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles.map(String) : [];
      pending = resolver(roles).catch(() => [] as string[]);
      CollectionAccessPolicyService.requestPermissions.set(req, pending);
    }
    return pending;
  }

  private isAdmin(user: any): boolean {
    return Array.isArray(user?.roles) && user.roles.includes('admin');
  }

  private isConstraint(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /** Whether `error` is this policy refusing access — not some other failure along the way. */
  static isRefusal(error: unknown): boolean {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    return status === 401 || status === 403;
  }

  private throwAuthError(req: any, message: string): never {
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = req?.user ? 403 : 401;
    throw error;
  }

  /** True when the collection explicitly turns this operation off via its `api` declaration. */
  private isOperationDisabled(collection: ICollection, action: WriteOperation): boolean {
    return (collection.api as Record<string, boolean> | undefined)?.[action.value] === false;
  }

  /**
   * 405, not 403: the operation does not exist for this collection at all, for any caller. A 403
   * would suggest a different user could do it.
   */
  private throwOperationDisabled(collection: ICollection, action: WriteOperation): never {
    const error = new Error(
      `Collection "${collection.slug}" does not support ${action.value}.`,
    ) as Error & { statusCode?: number };
    error.statusCode = 405;
    throw error;
  }
}
