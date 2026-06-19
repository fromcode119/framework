export interface NewRolePermissionsCardProps {
  theme: string;
  permissions: any[];
  selected: string[];
  onToggle: (perm: string) => void;
}
