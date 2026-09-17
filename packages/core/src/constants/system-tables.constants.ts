/**
 * Every physical table the framework owns, by role.
 *
 * Split out of `SystemConstants`, which had grown to 656 lines — two large maps and a page of
 * unrelated limits in one file. The names are reached as `SystemConstants.TABLE.*` exactly as before:
 * this holds the literal, `SystemConstants` names it, and no call site changes.
 *
 * `as const` is load-bearing. Several places derive types from these values (a settings key union, a
 * scoped-table check); widen them to `string` and those derivations stop catching anything.
 */
export class SystemTables {
  static readonly ALL = {
    /**
     * The tenant registry. This is the table that RESOLVES tenancy, so it is the one table that is
     * never itself tenant-scoped and carries no row-level-security policy — it must be readable
     * before a tenant is known.
     */
    TENANTS: '_system_tenants',
    /** One account's access to one tenant. See TenantMembership — identity is global, access is not. */
    TENANT_MEMBERSHIPS: '_system_tenant_memberships',
    /**
     * Which plugins one tenant runs. INSTALLATION is platform-wide (`PLUGINS` below); only
     * ENABLEMENT is per tenant, because a tenant cannot put code on disk — it can only turn on code
     * the operator already installed.
     */
    TENANT_PLUGINS: '_system_tenant_plugins',
    /** Which theme one tenant renders with. Install is platform-wide (`THEMES`); only activation is per tenant. */
    TENANT_THEMES: '_system_tenant_themes',
    /**
     * One TLS certificate per exact host. Platform-level and never tenant-scoped: whatever terminates
     * TLS loads every host's certificate before a request exists, so there is no tenant to scope to.
     * `tenant_id` on the row is for display and cascade only.
     */
    CERTIFICATES: '_system_certificates',
    /**
     * The account the platform holds with a certificate authority, one per directory URL.
     *
     * Registered once and reused forever. That is not an optimisation: authorities cap how many new
     * accounts one address may register in a window, so a deployment that registered per order would
     * eventually be refused for a reason that looks nothing like its cause.
     */
    ACME_ACCOUNTS: '_system_acme_accounts',
    /**
     * Challenge tokens awaiting validation. Written before an order is placed and read by the public
     * challenge route; the values are public by protocol, so nothing here is secret.
     */
    ACME_CHALLENGES: '_system_acme_challenges',
    /**
     * Permission to look at a site that is not published yet, handed from the admin to the site's
     * own host.
     *
     * PLATFORM-LEVEL, like the certificates table and for the same reason: the grant is minted on
     * the ADMIN host, bound to one site, and spent on THAT SITE'S host — three different requests,
     * only one of which is bound to the site it is about. A tenant-scoped table could not be read by
     * the first of them. `tenant_id` on the row is the binding, and it is checked on every read.
     *
     * Only hashes are stored. Neither the one-time grant nor the session that replaces it can be
     * read back out of the table, so a copy of the database is not a set of working preview links.
     */
    SITE_PREVIEW_GRANTS: '_system_site_preview_grants',
    USERS: 'users',
    ROLES: '_system_roles',
    PERMISSIONS: '_system_permissions',
    PLUGINS: '_system_plugins',
    PLUGIN_SETTINGS: '_system_plugin_settings',
    THEMES: '_system_themes',
    SESSIONS: '_system_sessions',
    LOGS: '_system_logs',
    AUDIT_LOGS: '_system_audit_logs',
    NOTIFICATIONS: '_system_notifications',
    WEBHOOK_DELIVERIES: '_system_webhook_deliveries',
    EMAIL_SUPPRESSIONS: '_system_email_suppressions',
    META: '_system_meta',
    MEDIA: 'media',
    MEDIA_FOLDERS: 'media_folders',
    RECORD_VERSIONS: '_system_record_versions',
    WEBHOOKS: '_system_webhooks',
    SCHEDULER_TASKS: '_system_scheduler_tasks',
    USERS_ROLES: '_system_users_roles',
    MIGRATIONS: '_system_migrations',
    PEOPLE: 'people',
    PERSON_RELATIONSHIPS: 'person_relationships',
    PEOPLE_ADDRESSES: 'people_addresses',
    PERSON_CATALOGS: 'person_catalogs',
    // Private-file delivery. A SHARE is the send (files + message + policy defaults); a GRANT is one
    // recipient's access to it, carrying its own token so a single person can be revoked without
    // cutting off the others; the ACCESS LOG is the audit trail of what was actually opened.
    FILE_SHARES: '_system_file_shares',
    FILE_GRANTS: '_system_file_grants',
    FILE_ACCESS_LOG: '_system_file_access_log'
  } as const;
}
