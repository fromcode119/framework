export interface NewUserRolesCardProps {
  theme: string;
  roles: any[];
  loadingRoles: boolean;
  selectedRoles: string[];
  rolesError?: string;
  onToggleRole: (slug: string) => void;
}
