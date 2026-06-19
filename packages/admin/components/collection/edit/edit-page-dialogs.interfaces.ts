export interface OverrideTarget {
  name: string;
  label: string;
}

export interface EditPageDialogsProps {
  readOnlyOverrideTarget: OverrideTarget | null;
  setReadOnlyOverrideTarget: (target: OverrideTarget | null) => void;
  openReadOnlyOverridePasswordPrompt: () => void;
  readOnlyOverridePasswordTarget: OverrideTarget | null;
  setReadOnlyOverridePasswordTarget: (target: OverrideTarget | null) => void;
  handleReadOnlyOverridePasswordConfirm: (password: string) => void;
  readOnlyOverrideVerifying: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (open: boolean) => void;
  handleDelete: () => void;
  deleting: boolean;
}
