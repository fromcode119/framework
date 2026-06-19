export interface EditFooterProps {
  collection: any;
  theme: string;
  isNew: boolean;
  discardHref?: string;
  handleSubmit: (e: any, summary: string) => void;
  changeSummary: string;
  setChangeSummary: (val: string) => void;
  saving: boolean;
  router: any;
}
