/** Everything a usage report says. Nothing else is ever added to it on the way out. */
export interface IUsageReport {
  installId: string;
  frameworkVersion: string;
  nodeVersion: string;
  database: string;
  platform: string;
  sites: number;
  plugins: { slug: string; version: string }[];
}
