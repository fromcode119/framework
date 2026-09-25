/** One `_system_meta` row a settings save wrote: the key, and the site that owns the row (null = the platform's). */
export interface ISettingWrite {
  key: string;
  tenantId: string | null;
}
