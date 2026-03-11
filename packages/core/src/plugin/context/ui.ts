import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';


export class UiContextProxy {
  static createUiProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface
) {
      return {
        registerHeadInjection: (injection: any) => {
          const slug = plugin.manifest.slug;
          const injections = manager.headInjections.get(slug) || [];

          const existingIndex = injections.findIndex(inj => {
            if (inj.tag !== injection.tag) return false;
            if (injection.props.id && inj.props.id === injection.props.id) return true;
            if (injection.props.name && inj.props.name === injection.props.name) return true;
            if (injection.props.src && inj.props.src === injection.props.src) return true;
            if (injection.props.href && inj.props.href === injection.props.href) return true;
            return false;
          });

          if (existingIndex >= 0) {
            injections[existingIndex] = injection;
          } else {
            injections.push(injection);
          }
          manager.headInjections.set(slug, injections);
        }
      };

  }
}