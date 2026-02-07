import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import * as esbuild from 'esbuild';
import { getProjectRoot, ask, t, compileStyles } from '../utils';

export function registerThemeCommands(program: Command) {
  const theme = program.command('theme').description('Manage themes');

  theme
    .command('create [name]')
    .description('Create a new theme scaffold')
    .action(async (name) => {
      try {
        let themeName = name;
        if (!themeName) {
          themeName = await ask(chalk.blue('Theme name: '));
        }

        if (!themeName) {
          console.error(chalk.red('Theme name is required!'));
          return;
        }

        let slug = themeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        slug = await ask(chalk.blue(`Theme slug [${slug}]: `));
        if (!slug) slug = themeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const themesDir = path.join(getProjectRoot(), 'themes');
        const themePath = path.join(themesDir, slug);

        if (fs.existsSync(themePath)) {
          console.error(chalk.red(`Theme directory already exists: ${themePath}`));
          return;
        }

        console.log(chalk.green(`\nCreating theme "${themeName}" in ${themePath}...`));

        await fs.ensureDir(themePath);
        await fs.ensureDir(path.join(themePath, 'ui/layouts'));

        const themeJson = {
          slug,
          name: themeName,
          version: '1.0.0',
          description: `Custom theme ${themeName}`,
          author: 'Me',
          screenshot: 'screenshot.png',
          config: {
            colors: {
              primary: '#3b82f6',
              secondary: '#10b981'
            }
          }
        };

        await fs.writeJson(path.join(themePath, 'theme.json'), themeJson, { spaces: 2 });
        
        await fs.writeFile(path.join(themePath, 'ui/theme.css'), `
:root {
  --primary: ${themeJson.config.colors.primary};
  --secondary: ${themeJson.config.colors.secondary};
}
`.trim() + '\n');

        await fs.writeFile(path.join(themePath, 'ui/index.ts'), `
import './theme.css';

export const init = () => {
  console.log('[Theme: ${slug}] Initialized');
};
`.trim() + '\n');

        console.log(chalk.green('\nTheme scaffolded successfully!'));

      } catch (error) {
        console.error(chalk.red('Error creating theme:'), error);
      }
    });

  theme
    .command('list')
    .description('List all installed themes')
    .action(async () => {
      try {
        const themesDir = path.join(getProjectRoot(), 'themes');
        if (!fs.existsSync(themesDir)) {
          console.log(chalk.yellow('No themes directory found.'));
          return;
        }

        const dirs = await fs.readdir(themesDir);
        console.log(chalk.blue('\nInstalled Themes:'));
        
        for (const dir of dirs) {
          if (dir.startsWith('.')) continue;
          const jsonPath = path.join(themesDir, dir, 'theme.json');
          if (await fs.pathExists(jsonPath)) {
            const data = await fs.readJson(jsonPath);
            console.log(`- ${chalk.bold(data.name)} (${chalk.cyan(dir)}) v${data.version}`);
          }
        }
      } catch (error) {
        console.error(chalk.red('Error listing themes:'), error);
      }
    });

  theme
    .command('build <slug>')
    .description('Build theme assets')
    .action(async (slug) => {
      try {
        const themesDir = path.join(getProjectRoot(), 'themes');
        const themeDir = path.join(themesDir, slug);
        if (!fs.existsSync(themeDir)) {
          console.error(chalk.red(`Theme directory not found: ${themeDir}`));
          return;
        }

        const uiDir = path.join(themeDir, 'ui');
        const entryFile = path.join(uiDir, 'index.ts');
        const outFile = path.join(uiDir, 'bundle.js');

        if (!fs.existsSync(entryFile)) {
          console.error(chalk.red(`Entry file not found: ${entryFile}`));
          return;
        }

        console.log(chalk.blue(`\nBuilding theme: ${chalk.bold(slug)}...`));
        
        await compileStyles(uiDir);

        await esbuild.build({
          entryPoints: [entryFile],
          bundle: true,
          minify: true,
          sourcemap: true,
          format: 'esm',
          platform: 'browser',
          target: ['es2020'],
          outfile: outFile,
          loader: {
            '.css': 'css',
            '.svg': 'dataurl',
            '.png': 'dataurl'
          },
          external: ['react', 'react-dom', '@fromcode/react', 'lucide-react']
        });

        console.log(chalk.green('Theme build completed successfully!'));

      } catch (error) {
        console.error(chalk.red('Error building theme:'), error);
      }
    });

  theme
    .command('dev <slug>')
    .description('Run theme development mode with watch/rebuild')
    .action(async (slug) => {
      try {
        const themesDir = path.join(getProjectRoot(), 'themes');
        const themeDir = path.join(themesDir, slug);
        if (!fs.existsSync(themeDir)) {
          console.error(chalk.red(`Theme directory not found: ${themeDir}`));
          return;
        }

        const uiDir = path.join(themeDir, 'ui');
        const entryFile = path.join(uiDir, 'index.ts');
        const outFile = path.join(uiDir, 'bundle.js');

        if (!fs.existsSync(entryFile)) {
          console.error(chalk.red(`Entry file not found: ${entryFile}`));
          return;
        }

        console.log(chalk.blue(`\n🚀 Starting Theme Development Mode: ${chalk.bold(slug)}`));
        console.log(chalk.gray('Watching for changes in:'), uiDir);
        
        const ctx = await esbuild.context({
          entryPoints: [entryFile],
          bundle: true,
          minify: false,
          sourcemap: 'inline',
          format: 'esm',
          platform: 'browser',
          target: ['es2020'],
          outfile: outFile,
          loader: {
            '.css': 'css',
            '.svg': 'dataurl',
            '.png': 'dataurl'
          },
          external: ['react', 'react-dom'],
          plugins: [{
            name: 'rebuild-logger',
            setup(build) {
              build.onEnd(result => {
                if (result.errors.length > 0) {
                  console.log(chalk.red('❌ Build failed with errors'));
                } else {
                  console.log(chalk.green(`✓ Rebuilt theme ${slug} at ${new Date().toLocaleTimeString()}`));
                }
              });
            }
          }]
        });

        await ctx.watch();
        console.log(chalk.gray('Keep this terminal open, or press Ctrl+C to stop.'));

      } catch (error) {
        console.error(chalk.red('Error in theme dev mode:'), error);
      }
    });

  theme
    .command('pack <slug>')
    .description('Pack a theme into a ZIP')
    .action(async (slug) => {
      try {
        const themesDir = path.join(getProjectRoot(), 'themes');
        const themePath = path.join(themesDir, slug);

        if (!fs.existsSync(themePath)) {
          console.error(chalk.red(`Theme directory not found: ${themePath}`));
          return;
        }

        const jsonPath = path.join(themePath, 'theme.json');
        const themeJson = await fs.readJson(jsonPath);
        const version = themeJson.version || '1.0.0';
        
        const outDir = path.resolve(process.cwd(), 'dist');
        await fs.ensureDir(outDir);
        
        const zipName = `theme-${slug}-${version}.zip`;
        const zipPath = path.join(outDir, zipName);

        console.log(chalk.blue(`\nPacking theme ${chalk.bold(slug)} v${version}...`));
        
        // Ensure theme is built before packing
        if (fs.existsSync(path.join(themePath, 'package.json'))) {
           console.log(chalk.gray('Running theme build...'));
           const { execSync } = require('child_process');
           try {
             execSync('npm run build', { cwd: themePath, stdio: 'inherit' });
           } catch (e) {
             console.warn(chalk.yellow('Warning: Build failed, packing as-is.'));
           }
        }

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => { throw err; });
        archive.pipe(output);
        archive.directory(themePath, false);
        await archive.finalize();

        console.log(chalk.green(`\nTheme packed successfully!`));
        console.log(chalk.gray(`Output: ${zipPath}`));

      } catch (error) {
        console.error(chalk.red('Error packing theme:'), error);
      }
    });
}
