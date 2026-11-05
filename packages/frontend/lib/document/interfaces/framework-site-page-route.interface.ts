/** One path the framework owns: the recipe its page carries, its title key, and when it is offered. */
export interface IFrameworkSitePageRoute {
  readonly recipe: string;
  readonly titleKey: string;
  readonly needsAuth: boolean;
  readonly needsRegistration: boolean;
}
