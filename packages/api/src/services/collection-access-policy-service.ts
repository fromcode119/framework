import { WriteOperation } from '@api/services/enums/write-operation.enum';
import { ICollection, EnvUtils } from '@fromcode119/core';

export class CollectionAccessPolicyService {
  async resolveReadConstraints(collection: ICollection, req: any): Promise<Record<string, unknown>> {
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
    // resolution reads content collections (cms pages/posts, products) anonymously — so this must stay
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

  private isAdmin(user: any): boolean {
    return Array.isArray(user?.roles) && user.roles.includes('admin');
  }

  private isConstraint(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
