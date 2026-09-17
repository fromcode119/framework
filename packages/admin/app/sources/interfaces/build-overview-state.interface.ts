import type { SourceEditorMode } from '@/app/sources/enums/source-editor-mode.enum';
export interface IBuildOverviewState {
  builds: any[];
  deletingKey: string | null;
  editingBuild: any | null;
  editorMode: SourceEditorMode | null;
  error: string;
  loading: boolean;
  savingSource: boolean;
  triggerKey: string | null;
  triggering: boolean;
  checking: boolean;
}
