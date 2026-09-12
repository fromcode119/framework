export interface IBuildOverviewState {
  builds: any[];
  deletingKey: string | null;
  editingBuild: any | null;
  editorMode: 'create' | 'edit' | null;
  error: string;
  loading: boolean;
  savingSource: boolean;
  triggerKey: string | null;
  triggering: boolean;
  checking: boolean;
}
