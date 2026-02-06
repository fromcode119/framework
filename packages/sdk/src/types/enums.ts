export enum PluginCapability {
  API = 'api',
  DATABASE = 'database',
  DATABASE_READ = 'database:read',
  DATABASE_WRITE = 'database:write',
  FILESYSTEM_READ = 'filesystem:read',
  FILESYSTEM_WRITE = 'filesystem:write',
  NETWORK = 'network',
  PLUGINS = 'plugins:interact',
  HOOKS = 'hooks',
  EMAIL = 'email',
  CACHE = 'cache',
  I18N = 'i18n',
  CONTENT = 'content',
  JOBS = 'jobs',
  SCHEDULER = 'scheduler',
  REDIS_GLOBAL = 'redis:global'
}

export enum MiddlewareStage {
  PRE_AUTH = 'pre_auth',
  POST_AUTH = 'post_auth',
  PRE_ROUTING = 'pre_routing'
}

export type FieldType = 
  | 'text' 
  | 'textarea'
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime'
  | 'select' 
  | 'relationship' 
  | 'richText' 
  | 'upload'
  | 'json'
  | 'array'
  | 'group'
  | 'color'
  | 'code';
