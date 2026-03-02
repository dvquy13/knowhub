import { Command } from 'commander';
import { input, select, confirm, password } from '@inquirer/prompts';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { loadUserConfig, userConfigPath } from '../config/loader.js';
import { writeUserConfig, writeHubFileConfig } from '../config/writer.js';
import { DEFAULT_HUB_FILE_CONFIG } from '../config/defaults.js';
import { getProvider } from '../providers/factory.js';
import { gitClone, gitAdd, gitCommit, gitPush, gitInit, gitRemoteAdd } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { KnowhubError, getErrorMessage } from '../utils/errors.js';
import type { HubConfig, HubFileConfig, UserConfig } from '../config/types.js';

export function makeInitCommand(): Command {
  return new Command('init')
    .description('Set up a new knowledge hub')
    .option('--hub <name>', 'Name for this hub (skips prompt)')
    .action(async (opts: { hub?: string }) => {
      logger.info('Welcome to knowhub! Let\'s set up your knowledge hub.\n');

      // Step 1: Hub name
      const hubName = opts.hub ?? await input({
        message: 'Hub name (used to reference this hub in commands):',
        default: 'personal',
        validate: (v) => v.trim().length > 0 || 'Hub name is required',
      });

      // Step 2: Provider choice
      const provider = await select({
        message: 'Which git provider?',
        choices: [
          { name: 'GitHub', value: 'github' as const },
          { name: 'GitLab', value: 'gitlab' as const },
        ],
      });

      // Step 3: Token
      const tokenHint = provider === 'github'
        ? 'https://github.com/settings/tokens/new?scopes=repo'
        : 'https://gitlab.com/-/profile/personal_access_tokens';
      logger.info(`\nYou need a personal access token with repo/project permissions.`);
      logger.info(`Create one at: ${tokenHint}\n`);

      const token = await password({
        message: `${provider === 'github' ? 'GitHub' : 'GitLab'} personal access token:`,
        validate: (v) => v.trim().length > 0 || 'Token is required',
      });

      // Step 4: Repo — create new or use existing
      const repoAction = await select({
        message: 'Repository:',
        choices: [
          { name: 'Create a new repository', value: 'create' as const },
          { name: 'Use an existing repository', value: 'existing' as const },
        ],
      });

      const hubConfig: HubConfig = { repo: '', provider, local: '', token };
      let cloneUrl: string;

      if (repoAction === 'create') {
        const repoName = await input({
          message: 'New repository name:',
          default: 'my-knowledge-hub',
          validate: (v) => v.trim().length > 0 || 'Repository name is required',
        });
        const isPrivate = await confirm({ message: 'Make it private?', default: true });
        const description = 'Personal knowledge hub — managed by knowhub';

        // Use placeholder owner/repo — createRepo doesn't need them
        const tempHub: HubConfig = { repo: 'placeholder/placeholder', provider, token, local: '/tmp' };
        const providerClient = getProvider(tempHub);

        logger.info('\nCreating repository...');
        let repoInfo;
        try {
          repoInfo = await providerClient.createRepo(repoName, description, isPrivate);
        } catch (err) {
          throw new KnowhubError(
            `Failed to create repository: ${getErrorMessage(err)}`,
            1,
            'Check that your token has the required repo/project permissions'
          );
        }

        hubConfig.repo = repoInfo.fullName;
        cloneUrl = repoInfo.cloneUrl;
        logger.success(`Repository created: ${repoInfo.fullName}`);
      } else {
        const repoInput = await input({
          message: `Repository path (e.g., ${provider === 'github' ? 'username/my-learnings' : 'username/my-learnings'}):`,
          validate: (v) => v.includes('/') || 'Expected format: owner/repo',
        });
        hubConfig.repo = repoInput.trim();

        // Verify token works by fetching repo info
        const tempHub: HubConfig = { repo: hubConfig.repo, provider, token, local: '/tmp' };
        const providerClient = getProvider(tempHub);

        logger.info('\nVerifying token and repository access...');
        let repoInfo;
        try {
          repoInfo = await providerClient.getRepoInfo();
        } catch (err) {
          throw new KnowhubError(
            `Failed to access repository: ${getErrorMessage(err)}`,
            1,
            'Check your token permissions and repository path'
          );
        }

        cloneUrl = repoInfo.cloneUrl;
        logger.success(`Repository found: ${repoInfo.fullName}`);
      }

      // Step 5: Local path for clone
      const defaultLocal = resolve(homedir(), 'knowledge-hubs', hubName);
      const localPath = await input({
        message: 'Local path for the hub repo:',
        default: defaultLocal,
        validate: (v) => v.trim().length > 0 || 'Path is required',
      });

      hubConfig.local = resolve(localPath);

      // Step 6: Clone or init
      if (existsSync(hubConfig.local)) {
        logger.info(`Directory already exists at ${hubConfig.local}, using it as-is.`);
      } else {
        const shouldClone = repoAction === 'existing';
        if (shouldClone) {
          logger.info(`\nCloning ${hubConfig.repo}...`);
          gitClone(cloneUrl, hubConfig.local);
        } else {
          // New repo: init locally then push
          logger.info(`\nInitializing local repository...`);
          await fs.mkdir(hubConfig.local, { recursive: true });
          gitInit(hubConfig.local);
          gitRemoteAdd(hubConfig.local, 'origin', cloneUrl);
        }
      }

      // Step 7: Scaffold hub files
      logger.info('\nScaffolding hub structure...');
      const hubFileConfig: HubFileConfig = { ...DEFAULT_HUB_FILE_CONFIG, name: hubName };

      // Create knowledge directory
      const knowledgeDir = join(hubConfig.local, hubFileConfig.structure.knowledge_dir);
      await fs.mkdir(knowledgeDir, { recursive: true });

      // Write .knowhub.yml if it doesn't exist
      const hubYmlPath = join(hubConfig.local, '.knowhub.yml');
      if (!existsSync(hubYmlPath)) {
        await writeHubFileConfig(hubConfig.local, hubFileConfig);
        logger.success('Created .knowhub.yml');
      }

      // Write INDEX.md if it doesn't exist
      const indexPath = join(hubConfig.local, hubFileConfig.structure.index_file);
      if (!existsSync(indexPath)) {
        const indexContent = `# ${hubName} — Knowledge Index\n\n_Your knowledge base is empty. Run \`knowhub absorb\` after capturing some learnings._\n`;
        await fs.writeFile(indexPath, indexContent, 'utf-8');
        logger.success('Created INDEX.md');
      }

      // Commit and push for new repos
      if (repoAction === 'create') {
        try {
          gitAdd(hubConfig.local);
          gitCommit(hubConfig.local, 'knowhub: initial scaffold');
          gitPush(hubConfig.local);
          logger.success('Pushed initial commit');
        } catch (err) {
          logger.warn(`Could not push: ${getErrorMessage(err)}`);
        }
      }

      // Step 8: Write user config
      const userConfig: UserConfig = await loadUserConfig();
      userConfig.hubs[hubName] = hubConfig;
      if (!userConfig.default_hub) {
        userConfig.default_hub = hubName;
      }
      await writeUserConfig(userConfig);
      logger.success(`Configuration saved to ${userConfigPath()}`);

      // Done!
      logger.info(`\n✓ Hub "${hubName}" is ready!`);
      logger.info(`  Capture a learning:  knowhub capture "TIL: something useful"`);
      logger.info(`  Synthesize:          knowhub absorb`);
    });
}
