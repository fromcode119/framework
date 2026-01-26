import fs from 'fs';
import path from 'path';
import { PluginManifest } from '../types';
import { PluginManager } from '../plugin/manager';

export class NodePluginLoader {
  constructor(private manager: PluginManager) {}

  async loadFromDirectory(pluginsDir: string): Promise<void> {
    if (!fs.existsSync(pluginsDir)) {
      console.warn(`[NodePluginLoader] Directory not found: ${pluginsDir}`);
      return;
    }

    const folders = fs.readdirSync(pluginsDir).filter(f => 
      fs.statSync(path.join(pluginsDir, f)).isDirectory()
    );

    for (const folder of folders) {
      const pluginPath = path.join(pluginsDir, folder);
      let manifestPath = path.join(pluginPath, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        manifestPath = path.join(pluginPath, 'plugin.json');
      }

      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.enabled === false) continue;

        // In a real implementation, we would dynamic import the entry point
        // const entry = manifest.entryPoint || 'index.js';
        // const pluginModule = await import(path.join(pluginPath, entry));
        // this.manager.register(pluginModule.default || pluginModule);
        
        console.log(`[NodePluginLoader] Found plugin: ${manifest.name} (${manifest.slug})`);
      } catch (error) {
        console.error(`[NodePluginLoader] Failed to load plugin from ${folder}:`, error);
      }
    }
  }
}
