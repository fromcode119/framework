export interface IEntityAdminLayout {
  sections?: Array<{ name: string; label: string; description?: string }>;
  tabs?: Array<{ name: string; label: string; icon?: string }>;
}
