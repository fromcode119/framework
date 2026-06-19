export type ThemeLayoutOption = { label: string; value: string; description?: string };

export type ThemeLayoutFieldState = {
  options: ThemeLayoutOption[];
  layoutInfoByValue: Record<string, ThemeLayoutOption>;
  runtimeDefaultLayout: string;
  loading: boolean;
};
