import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { CliUtils } from '@cli/utils';
import { ThemeSeedCommandService } from '@cli/services/theme-seed-command-service';
import { ThemeBuildCommandService } from '@cli/services/theme-build-command-service';
import { ThemeScaffoldFiles } from '@cli/commands/theme-scaffold-files';

export class ThemeCommands {
  static registerThemeCommands(program: Command) {
    const theme = program.command('theme').description('Manage themes');

    theme
      .command('create [name]')
      .description('Create a new theme scaffold')
      .action(async (name) => {
        try {
          let themeName = name;
          if (!themeName) {
            themeName = await CliUtils.ask(chalk.blue('Theme name: '));
          }

          if (!themeName) {
            console.error(chalk.red('Theme name is required!'));
            return;
          }

          let slug = themeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          slug = await CliUtils.ask(chalk.blue(`Theme slug [${slug}]: `));
          if (!slug) slug = themeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

          const themesDir = path.join(CliUtils.getProjectRoot(), 'themes');
          const themePath = path.join(themesDir, slug);

          if (fs.existsSync(themePath)) {
            console.error(chalk.red(`Theme directory already exists: ${themePath}`));
            return;
          }

          console.log(chalk.green(`\nCreating theme "${themeName}" in ${themePath}...`));

          // A theme ships NO hand-written entry file. `ThemeEntryGenerator.resolveEntry` GENERATES
          // `src/theme-entry.generated.jsx` from theme.json's "build" block (styles/components/
          // eagerComponents globs) unless the theme hand-authors `src/index.jsx` — which this scaffold
          // does not, so it declares its glob patterns instead. The generated entry hands its component
          // maps to the boot class named in "build.boot" (default `@theme/theme-boot` → `ThemeBoot`),
          // so the one file this scaffold DOES write by hand is `src/theme-boot.ts`.
          await fs.ensureDir(themePath);
          await fs.ensureDir(path.join(themePath, 'src/styles'));

          const colors = {
            primary: '#3b82f6',
            secondary: '#10b981',
          };

          const themeJson = {
            slug,
            name: themeName,
            version: '1.0.0',
            description: `Custom theme ${themeName}`,
            author: 'Me',
            screenshot: 'screenshot.png',
            config: { colors },
            // `ui.entry`/`ui.css` are the BUILD OUTPUT the Vite theme build emits — `bundle.js` and
            // `<slug>-theme.css` (see `ThemeViteConfig`'s asset naming). Declared here so the admin can
            // resolve them once the theme is built; nothing on disk yet.
            ui: {
              entry: 'bundle.js',
              css: [`${slug}-theme.css`],
            },
            // Glob patterns `ThemeEntryGenerator` reads to generate the Vite entry. Empty until this
            // theme declares real layouts/block renderers — an empty scaffold ships no invented ones.
            build: {
              styles: ['./styles/*.css'],
              components: [],
              eagerComponents: [],
            },
            // No third-party UI library declared yet, so no chunk to split out — everything unclaimed
            // lands in the generic `vendor` chunk (see `ThemeViteConfig`). Add an entry here (and to this
            // theme's own package.json `dependencies`) once one is.
            vendorChunks: {},
          };

          await fs.writeJson(path.join(themePath, 'theme.json'), themeJson, { spaces: 2 });

          await fs.writeFile(path.join(themePath, 'src/styles/theme.css'), ThemeScaffoldFiles.css(colors));
          await fs.writeFile(path.join(themePath, 'src/theme-boot.ts'), ThemeScaffoldFiles.themeBoot(slug));

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
          const themesDir = path.join(CliUtils.getProjectRoot(), 'themes');
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
      .action(async (slug) => { await ThemeBuildCommandService.build(slug); });

    theme
      .command('dev <slug>')
      .description('Run theme development mode: rebuild on every change under src/')
      .action(async (slug) => { await ThemeBuildCommandService.dev(slug); });

    theme
      .command('pack <slug>')
      .description('Pack a theme into a ZIP')
      .action(async (slug) => {
        try {
          const themesDir = path.join(CliUtils.getProjectRoot(), 'themes');
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

    theme
      .command('seed')
      .description('Seed a theme (pages, navigation, categories) into the running site')
      .allowUnknownOption(true)
      .helpOption(false)
      .argument('[args...]', 'Seed flags: --theme <slug> [--no-restart] [--container <name>] [--database-url <url>] [--help]')
      .action(async (args: string[]) => {
        await ThemeSeedCommandService.run(args ?? []);
      });
  }
}