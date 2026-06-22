export interface DashboardQuickAction {
  label: string;
  href: string;
  icon: string;
}

export interface DashboardQuickActionsProps {
  actions: DashboardQuickAction[];
  onNavigate: (href: string) => void;
}
