export interface DashboardActivityChartProps {
  activity: Array<{ timestamp?: string | number; level?: string }>;
  days?: number;
}
