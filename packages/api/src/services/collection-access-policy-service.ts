import { Collection } from '@fromcode119/core';

type AccessConstraint = Record<string, unknown>;

export class CollectionAccessPolicyService {
  async resolveReadConstraints(collection: Collection, req: any): Promise<AccessConstraint> {
    const accessResult = await this.evaluateAccess(collection.access?.read, req);
    if (accessResult === true) {
      return {};
    }

    if (this.isConstraint(accessResult)) {
      return accessResult;
    }

    if (collection.system) {
      if (this.isAdmin(req?.user)) {
        return {};
      }

      this.throwAuthError(req, `Authentication is required to read system collection "${collection.slug}".`);
    }

    return {};
  }

  async ensureCreateAllowed(collection: Collection, req: any): Promise<void> {
    await this.ensureMutationAllowed(collection, req, 'create');
  }

  async ensureUpdateAllowed(collection: Collection, req: any): Promise<void> {
    await this.ensureMutationAllowed(collection, req, 'update');
  }

  async ensureDeleteAllowed(collection: Collection, req: any): Promise<void> {
    await this.ensureMutationAllowed(collection, req, 'delete');
  }

  matchesReadConstraints(record: Record<string, unknown> | null, constraints: AccessConstraint): boolean {
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
    collection: Collection,
    req: any,
    action: 'create' | 'update' | 'delete',
  ): Promise<void> {
    const accessResult = await this.evaluateAccess(collection.access?.[action], req);
    if (accessResult === true || this.isConstraint(accessResult)) {
      return;
    }

    if (this.isAdmin(req?.user)) {
      return;
    }

    this.throwAuthError(req, `Authentication is required to ${action} collection "${collection.slug}".`);
  }

  private async evaluateAccess(access: unknown, req: any): Promise<boolean | AccessConstraint | null> {
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

  private isConstraint(value: unknown): value is AccessConstraint {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private throwAuthError(req: any, message: string): never {
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = req?.user ? 403 : 401;
    throw error;
  }
}
