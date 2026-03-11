// ─── Companion types file for plugin-permissions-service.ts ─────────────────

export type PluginPermission = 
  | 'database:read'
  | 'database:write'
  | 'database:*'
  | 'api:routes'
  | 'navigation'
  | 'hooks'
  | 'admin:ui'
  | 'collections:modify'
  | 'file:read'
  | 'file:write'
  | 'network:outbound';
