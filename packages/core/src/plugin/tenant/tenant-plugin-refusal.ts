import { TenantPluginRefusalReason } from '@core/plugin/tenant/enums/tenant-plugin-refusal-reason.enum';

/** A site's plugin request refused for a stated reason, in words the site's admin is shown as they are. */
export class TenantPluginRefusal extends Error {
  constructor(readonly reason: TenantPluginRefusalReason, message: string) {
    super(message);
    this.name = 'TenantPluginRefusal';
  }
}
