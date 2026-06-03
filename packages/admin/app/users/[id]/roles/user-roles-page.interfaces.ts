export interface UserRolesPageProps {
  params: Promise<{ id: string }>;
}

export interface UserRolesPageState {
  routeId: string;
  user: any;
  roles: any[];
  selectedRoles: string[];
  loading: boolean;
  saving: boolean;
}
