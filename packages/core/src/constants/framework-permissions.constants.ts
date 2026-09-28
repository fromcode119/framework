import type { IPermissionDefinition } from '@core/interfaces/permission-definition.interface';
import { PermissionNames } from '@core/utils/permission-names';

/**
 * The permissions the framework itself checks — every one of them is asked for by a
 * `requirePermission(...)` on a framework route. Nothing belongs here that no gate reads: a permission
 * a role can hold but nothing checks is a checkbox that does nothing.
 *
 * Plugin permissions are not listed here. They are derived from what each plugin registers (its
 * collections, its own screens), so the list follows the plugins a site actually runs.
 */
export class FrameworkPermissions {
  static readonly DEFINITIONS: readonly IPermissionDefinition[] = [
    { name: PermissionNames.ALL, label: 'Everything', description: 'Full access to every screen and action, including every plugin. This is what the Administrator role holds.' },
    { name: 'system:view', label: 'Dashboard and activity', description: 'See the dashboard statistics, the activity log, webhooks and admin search.' },
    { name: 'users:view', label: 'See users', description: 'Open the user list and each user\'s details.' },
    { name: 'users:manage', label: 'Manage users', description: 'Create, edit and remove users, and change which roles they hold.' },
    { name: 'roles:view', label: 'See roles', description: 'Open the role list and the permission list.' },
    { name: 'roles:manage', label: 'Manage roles', description: 'Create, edit and delete roles. A role can only be given permissions its editor holds.' },
    { name: 'content:read', label: 'Use content tools', description: 'Shortcodes, data sources, page design and the content assistant.' },
    { name: 'content:write', label: 'Let the assistant change content', description: 'Run the content assistant\'s actions that write.' },
    { name: 'integrations:view', label: 'See integrations', description: 'Open the integrations settings.' },
    { name: 'integrations:manage', label: 'Manage integrations', description: 'Configure, test and switch integration providers.' },
    { name: 'system:manage', label: 'Manage settings', description: 'Change settings, redirects and the personal-data policy.' },
    { name: 'system:logs', label: 'Read logs', description: 'Open the system logs.' },
    { name: 'system:audit', label: 'Read the audit trail', description: 'Open the security audit trail.' },
    { name: 'system:update', label: 'Apply updates', description: 'Check for and apply platform updates.' },
    { name: 'system:backup:view', label: 'See backups', description: 'Open the backup list.' },
    { name: 'system:backup:manage', label: 'Make backups', description: 'Create and delete backups.' },
    { name: 'system:backup:restore', label: 'Restore backups', description: 'Restore the site from a backup.' },
    { name: 'system:deploy:restart', label: 'Restart the platform', description: 'Restart the running services.' },
  ];
}
