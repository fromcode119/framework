export interface IAdminAssistantUiPreferences {
  baseUrl: string;
  baseUrls: Record<string, string>;
  chatMode: string;
  leftSidebarOpen: boolean | null;
  model: string;
  provider: string;
  rightSidebarOpen: boolean | null;
  sandboxMode: boolean | null;
  skillId: string;
}
