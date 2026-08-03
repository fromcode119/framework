export interface IGlobalStubSetupArgs {
  ReactRef: typeof import('react');
  ReactDOMRef: any;
  FrameworkIcons: any;
  FrameworkIconRegistry: any;
  getIcon: (name: string) => any;
  IconNames: any;
  createProxyIcon: (...args: any[]) => any;
}
