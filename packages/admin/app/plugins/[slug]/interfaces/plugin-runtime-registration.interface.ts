/** One thing a plugin's process registered with the api (a route, hook, schedule, middleware, tools…). */
export interface IPluginRuntimeRegistration {
  kind: string;
  method?: string;
  path?: string;
  event?: string;
  name?: string;
  schedule?: string;
  key?: string;
  middleware?: { id: string; stage: string };
  tools?: Array<{ tool?: string }>;
}
