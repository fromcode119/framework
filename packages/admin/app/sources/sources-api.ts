import { AdminApi } from '@/lib/api';
import { SourcesRouteService } from '@/app/sources/sources-route-service';

/**
 * The admin's calls to the Sources API.
 *
 * Replaces a plugin client reached through `this.namespace('org.fromcode')['sources']`. That
 * indirection existed because a plugin screen could only address its own plugin's routes through the
 * plugin runtime; Sources is framework surface, so the admin calls it like any other framework
 * endpoint.
 */
export class SourcesApi {
  /** `silent` matters: this list is POLLED, and a failed poll must not raise a toast every tick. */
  /** What this installation can fetch source from. Drives the provider field. */
  static providers(): Promise<any> { return AdminApi.get(SourcesRouteService.providers()); }

  static list(options?: { silent?: boolean }): Promise<any> {
    return AdminApi.get(SourcesRouteService.list(), options as RequestInit | undefined);
  }
  static create(input: Record<string, unknown>): Promise<any> { return AdminApi.post(SourcesRouteService.create(), input); }
  static update(slug: string, input: Record<string, unknown>): Promise<any> { return AdminApi.patch(SourcesRouteService.one(slug), input); }
  static remove(slug: string): Promise<any> { return AdminApi.delete(SourcesRouteService.one(slug)); }
  static buildAll(): Promise<any> { return AdminApi.post(SourcesRouteService.buildAll(), {}); }
  static buildOne(slug: string): Promise<any> { return AdminApi.post(SourcesRouteService.buildOne(slug), {}); }
  static checkUpdates(): Promise<any> { return AdminApi.post(SourcesRouteService.checkUpdates(), {}); }
  static listBranches(input: Record<string, unknown>): Promise<any> { return AdminApi.post(SourcesRouteService.branches(), input); }
  static inspect(input: Record<string, unknown>): Promise<any> { return AdminApi.post(SourcesRouteService.inspect(), input); }
}
