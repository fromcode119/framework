export interface IBuildOverviewState {
  builds: any[];
  deletingSlug: string | null;
  editingBuild: any | null;
  editorMode: 'create' | 'edit' | null;
  error: string;
  loading: boolean;
  savingSource: boolean;
  triggerSlug: string | null;
  triggering: boolean;
  checking: boolean;
}
