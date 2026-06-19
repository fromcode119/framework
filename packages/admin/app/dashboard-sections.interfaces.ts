export interface DashboardUpdateAlertProps {
  updateAvailable: any;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export interface DashboardCollectionsGridProps {
  stats: any[];
  showAllCollections: boolean;
  onNavigate: (path: string) => void;
}

export interface DashboardActivityFeedProps {
  activity: any[];
  loadingActivity: boolean;
  hasMainContent: boolean;
  onViewAll: () => void;
}

export interface DashboardSupportCardProps {
  onNavigateFramework: () => void;
}
