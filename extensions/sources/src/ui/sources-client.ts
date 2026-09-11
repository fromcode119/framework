import { ApiScopeClient } from '@fromcode119/sdk';
import { SourcesRouteService } from '@plugin/src/ui/sources-route-service';

export class SourcesClient extends ApiScopeClient {
  static pluginClient = true;
  createSource(input: Record<string, unknown>, options?: any): Promise<any> {
    return (this as any).post(SourcesRouteService.getCreateSource(), input, options);
  }

  /** The branches a repository has, for the branch field. Empty when the remote cannot be read. */
  listBranches(input: Record<string, unknown>, options?: any): Promise<any> {
    return (this as any).post(SourcesRouteService.getBranches(), input, options);
  }

  /** What the repository declares itself to be. `declared` is null when it says nothing. */
  inspectSource(input: Record<string, unknown>, options?: any): Promise<any> {
    return (this as any).post(SourcesRouteService.getInspect(), input, options);
  }

  updateSource(slug: string, input: Record<string, unknown>, options?: any): Promise<any> {
    return (this as any).patch(SourcesRouteService.getUpdateSource(slug), input, options);
  }

  getStatus(options?: any): Promise<any> {
    return (this as any).get(SourcesRouteService.getStatus(), options);
  }

  getStatusBySlug(slug: string, options?: any): Promise<any> {
    return (this as any).get(SourcesRouteService.getStatusBySlug(slug), options);
  }

  triggerAll(options?: any): Promise<any> {
    return (this as any).post(SourcesRouteService.getTriggerAll(), undefined, options);
  }

  triggerOne(slug: string, options?: any): Promise<any> {
    return (this as any).post(SourcesRouteService.getTriggerOne(slug), undefined, options);
  }

  checkUpdates(options?: any): Promise<any> {
    return (this as any).post(SourcesRouteService.getCheckUpdates(), undefined, options);
  }

  deleteSource(slug: string, options?: any): Promise<any> {
    return (this as any).delete(SourcesRouteService.getDeleteSource(slug), options);
  }
}
