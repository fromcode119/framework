import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { ThemeScaffold } from '@fromcode119/core';
import { CliUtils } from '@cli/utils';
import { ThemeSeedCommandService } from '@cli/services/theme-seed-command-service';
import { ThemeBuildCommandService } from '@cli/services/theme-build-command-service';
import { ExtensionBuildCommandService } from '@cli/commands/extension-build-command-service';

export class ThemeCommands {
  static registerThemeCommands(program: Command) {
    const theme = program.command('theme').description('Manage themes');

    theme
      .command('create [name]')
      .description('Create a new theme: a theme that builds and renders, with its colours and fonts as editable settings')
      .action(async (name) => {
        try {
          const themeName = String(name || await CliUtils.ask(chalk.blue('Theme name: '))).trim();
          if (!themeName) {
            console.error(chalk.red('Theme name is required!'));
            return;
          }

          const suggested = ThemeScaffold.slugFor(themeName);
          const slug = String(await CliUtils.ask(chalk.blue(`Theme slug [${suggested}]: `)) || suggested).trim();
          // Asked, not invented: a made-up description would be shown to operators as if someone wrote it.
          const description = String(await CliUtils.ask(chalk.blue('One-line description (optional): '))).trim();

          const themePath = path.join(CliUtils.themesRoot(), slug);
          if (fs.existsSync(themePath)) {
            console.error(chalk.red(`Theme directory already exists: ${themePath}`));
            return;
          }

          const files: Record<string, string> = ThemeScaffold.files({ slug, name: themeName, description });
          console.log(chalk.green(`\nCreating theme "${themeName}" in ${themePath}...`));
          for (const [relativePath, content] of Object.entries(files)) {
            const target = path.join(themePath, relativePath);
            await fs.ensureDir(path.dirname(target));
            await fs.writeFile(target, content);
          }

          console.log(chalk.green(`\nTheme scaffolded (${Object.keys(files).length} files). Next:`));
          console.log(chalk.gray(`  atlantis build theme ${slug}`));
        } catch (error) {
          console.error(chalk.red('Error creating theme:'), error);
        }
      });

    theme
      .command('list')
      .description('List all installed themes')
      .action(async () => {
        try {
          const themesDir = CliUtils.themesRoot();
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

    // The same pipeline as `atlantis pack theme <slug>`. This command used to zip the raw source folder
    // itself — no integrity stamp, no SSR dependency closure, `node_modules` included — which no platform
    // could install, and since the archiver import stopped resolving it crashed before writing anything.
    theme
      .command('pack <slug>')
      .description('Pack a theme for distribution (same as `pack theme <slug>`)')
      .action(async (slug) => { await ExtensionBuildCommandService.run('theme', slug, true); });

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