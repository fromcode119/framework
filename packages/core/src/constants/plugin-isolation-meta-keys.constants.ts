/**
 * The plugin isolation limits (Settings → Infrastructure → Plugin Isolation). Part of
 * `SystemConstants.META_KEY` — spread into `SystemMetaKeys.ALL` — and split out only for size.
 */
export class PluginIsolationMetaKeys {
  static readonly ALL = {
    PLUGIN_ISOLATION_MEMORY_MB: 'plugin_isolation_memory_mb',
    PLUGIN_ISOLATION_TIMEOUT_MS: 'plugin_isolation_timeout_ms',
    /** What a plugin a SITE uploaded may hold of the shared machine. */
    PLUGIN_ISOLATION_SITE_CPU_PERCENT: 'plugin_isolation_site_cpu_percent',
    PLUGIN_ISOLATION_SITE_MEMORY_MB: 'plugin_isolation_site_memory_mb',
    PLUGIN_ISOLATION_SITE_DISK_MB: 'plugin_isolation_site_disk_mb',
    PLUGIN_ISOLATION_SITE_MAX_TASKS: 'plugin_isolation_site_max_tasks',
  } as const;
}
