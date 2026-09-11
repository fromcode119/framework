export class SourcesRouteService {
  static getCreateSource(): string { return '/sources'; }
  static getUpdateSource(slug: string): string { return `/sources/${slug}`; }
  static getTriggerAll(): string { return '/trigger'; }
  static getTriggerOne(slug: string): string { return `/trigger/${slug}`; }
  static getStatus(): string { return '/status'; }
  static getStatusBySlug(slug: string): string { return `/status/${slug}`; }
  static getDeleteSource(slug: string): string { return `/status/${slug}`; }
  static getCheckUpdates(): string { return '/check-updates'; }
  static getBranches(): string { return '/branches'; }
  static getInspect(): string { return '/inspect'; }
}
