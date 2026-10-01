import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * What a platform incident is about. One incident per kind and subject (a plugin, a site) at a time:
 * the monitor opens it when the check first fails and resolves it when the check passes again.
 *
 * Compare against `.value` — incidents are stored as JSON, and an Enum tested against a string is
 * always false.
 */
export class MonitoringIncidentKind extends Enum {
  /** A plugin is in error, or held until an admin re-approves it. */
  static readonly PLUGIN_UNHEALTHY = new MonitoringIncidentKind('plugin-unhealthy');
  /** A site's storefront did not answer, or answered with a server error. */
  static readonly SITE_DOWN = new MonitoringIncidentKind('site-down');
  /** The server's disk is past the configured threshold. */
  static readonly DISK_FULL = new MonitoringIncidentKind('disk-full');
  /** The server's memory is past the configured threshold. */
  static readonly MEMORY_FULL = new MonitoringIncidentKind('memory-full');
  /** The share of api requests that failed with a server error is past the configured threshold. */
  static readonly API_ERRORS = new MonitoringIncidentKind('api-errors');

  private constructor(value: string) {
    super(value);
  }
}
