import type { useRouter } from 'next/navigation';

/** Every context/router hook value the {@link AdminRuntimeProvider} bridge reads in one place. */
export interface IAdminRuntimeValues {
  theme: any;
  toggleTheme: () => void;
  notify: any;
  globalSettings: Record<string, any>;
  plugins: any;
  collections: any[];
  router: ReturnType<typeof useRouter>;
  pathname: string;
  params: Record<string, string | string[]>;
  auth: any;
}
