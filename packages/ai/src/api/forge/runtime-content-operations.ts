import { Request } from 'express';
import { AssistantRuntimeContentResolver } from '@ai/api/forge/runtime-content-resolver';

/**
 * The assistant's read/write access to content, made from ONE request.
 *
 * Every call goes back through the REST controller carrying that request's user, headers and
 * cookies, so the assistant can never read or write anything the person driving it could not: the
 * controller applies the same access policy, validation and lifecycle hooks an admin save does.
 * That is also why this is built per request rather than held on the service.
 */
export class AssistantRuntimeContentOperations {
  /** How many documents one listing may return, however large a limit the model asks for. */
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly restController: any,
    private readonly resolver: AssistantRuntimeContentResolver,
    private readonly req: Request,
  ) {}

  /** The request identity every call is made as. */
  private get actor(): { user: unknown; headers: unknown; cookies: unknown } {
    return { user: (this.req as any).user, headers: this.req.headers, cookies: (this.req as any).cookies };
  }

  private static raw(collection: any): any {
    return collection.raw || collection;
  }

  async list(collection: any, options: any): Promise<{ docs: any[]; totalDocs: number; limit: number; offset: number }> {
    const limit = Math.min(
      AssistantRuntimeContentOperations.MAX_LIMIT,
      Math.max(1, Number(options?.limit || 20)),
    );
    const offset = Math.max(0, Number(options?.offset || 0));
    const result = await this.restController.find(AssistantRuntimeContentOperations.raw(collection), {
      query: { limit, offset, preview: true },
      ...this.actor,
    });
    return {
      docs: Array.isArray(result?.docs) ? result.docs : [],
      totalDocs: Number(result?.totalDocs || 0),
      limit,
      offset,
    };
  }

  async resolve(collection: any, selector: any): Promise<any> {
    return this.resolver.resolveContentItem(collection, selector || {});
  }

  async create(collection: any, payload: any): Promise<any> {
    return this.restController.create(AssistantRuntimeContentOperations.raw(collection), {
      body: payload,
      query: {},
      params: {},
      ...this.actor,
    });
  }

  /**
   * The id is RESOLVED before the write, because the selector the assistant holds may not be the
   * collection's primary key — a collection keyed on something other than `id` would otherwise be
   * updated by an id that names no row, and the write would silently affect nothing.
   */
  async update(collection: any, targetId: unknown, payload: any): Promise<any> {
    const rawCollection = AssistantRuntimeContentOperations.raw(collection);
    const whereField = String(rawCollection?.primaryKey || 'id');

    const existing = await this.resolver.resolveContentItem(collection, { id: targetId } as any);
    const resolvedId = existing && typeof existing === 'object'
      ? (existing as any)[whereField] ?? (existing as any).id ?? targetId
      : targetId;

    return this.restController.update(rawCollection, {
      body: payload,
      query: {},
      params: { id: String(resolvedId) },
      ...this.actor,
    });
  }

  async listVersions(collection: any, refId: unknown, options: any): Promise<any> {
    return this.restController.versioning.getVersions(
      String(AssistantRuntimeContentOperations.raw(collection).slug), refId, options || {},
    );
  }

  async getVersion(collection: any, refId: unknown, version: unknown): Promise<any> {
    return this.restController.versioning.getVersion(
      String(AssistantRuntimeContentOperations.raw(collection).slug), refId, version,
    );
  }

  async restoreVersion(collection: any, refId: unknown, version: unknown): Promise<any> {
    return this.restController.versioning.restoreVersion(
      AssistantRuntimeContentOperations.raw(collection), refId, version, (this.req as any).user,
    );
  }
}
