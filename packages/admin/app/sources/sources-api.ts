import { AdminApi } from '@/lib/api';
import { SourcesRouteService } from '@/app/sources/sources-route-service';
import type { ISourceUpdateCheck } from '@/app/sources/interfaces/source-update-check.interface';

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
  static update(type: string, slug: string, input: Record<string, unknown>): Promise<any> { return AdminApi.patch(SourcesRouteService.one(type, slug), input); }
  static remove(type: string, slug: string): Promise<any> { return AdminApi.delete(SourcesRouteService.one(type, slug)); }
  static buildAll(): Promise<any> { return AdminApi.post(SourcesRouteService.buildAll(), {}); }
  static buildOne(type: string, slug: string): Promise<any> { return AdminApi.post(SourcesRouteService.buildOne(type, slug), {}); }
  static checkUpdates(): Promise<ISourceUpdateCheck> { return AdminApi.post(SourcesRouteService.checkUpdates(), {}); }
  static listBranches(input: Record<string, unknown>): Promise<any> { return AdminApi.post(SourcesRouteService.branches(), input); }
  static inspect(input: Record<string, unknown>): Promise<any> { return AdminApi.post(SourcesRouteService.inspect(), input); }

  /** What is running, what was last built, and every version still installable. */
  static versions(type: string, slug: string): Promise<any> { return AdminApi.get(SourcesRouteService.versions(type, slug)); }
  /** Puts a specific staged version in place. Replaces code that is serving, so POST. */
  static installVersion(type: string, slug: string, version: string): Promise<any> {
    return AdminApi.post(SourcesRouteService.install(type, slug), { version });
  }

  /**
   * Downloads the built package.
   *
   * Through the authenticated client rather than a plain link: the route is admin-guarded, and the
   * link this replaces pointed at `/themes/<file>.zip` — a path nothing had served since Sources
   * stopped being a plugin, so the button 404'd for as long as it had existed.
   */
  static downloadPackage(type: string, slug: string): Promise<{ blob: Blob; filename: string }> {
    return AdminApi.download(SourcesRouteService.packageArchive(type, slug));
  }
}
