export interface EditRolePermissionsCardProps {
  theme: string;
  permissions: any[];
  selected: string[];
  onToggle: (perm: string) => void;
}
