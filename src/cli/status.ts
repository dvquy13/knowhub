import { Command } from 'commander';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { loadUserConfig, userConfigPath, loadHubFileConfig } from '../config/loader.js';

function shortenPath(p: string): string {
  return p.startsWith(homedir()) ? p.replace(homedir(), '~') : p;
}

export function makeStatusCommand(): Command {
  return new Command('status')
    .description('show configuration and hub status')
    .action(async () => {
      const configPath = userConfigPath();
      const configExists = existsSync(configPath);

      console.log(`Config:  ${shortenPath(configPath)}  ${configExists ? '✓ found' : '✗ not found'}`);

      if (!configExists) {
        console.log('');
        console.log('Not initialized. Run `knowhub init` to get started.');
        return;
      }

      let userConfig;
      try {
        userConfig = await loadUserConfig();
      } catch {
        console.log('');
        console.log('Error reading config. Run `knowhub init` to reset.');
        return;
      }

      const hubEntries = Object.entries(userConfig.hubs);

      if (hubEntries.length === 0) {
        console.log('');
        console.log('Not initialized. Run `knowhub init` to get started.');
        return;
      }

      console.log(`\nHubs (${hubEntries.length}):\n`);

      for (const [name, hub] of hubEntries) {
        const isDefault = userConfig.default_hub === name;
        const defaultLabel = isDefault ? '  [default]' : '';
        console.log(`  ${name}${defaultLabel}`);
        console.log(`    provider:  ${hub.provider}`);
        console.log(`    repo:      ${hub.repo}`);

        const localShort = shortenPath(hub.local);
        const localExists = existsSync(hub.local);
        console.log(`    local:     ${localShort}  ${localExists ? '✓ cloned' : '✗ not cloned'}`);

        const envVar = hub.provider === 'github' ? 'GITHUB_TOKEN' : 'GITLAB_TOKEN';
        let tokenLine: string;
        if (hub.token) {
          tokenLine = 'set (config)';
        } else if (process.env[envVar]) {
          tokenLine = `set (env: ${envVar})`;
        } else {
          tokenLine = `missing ⚠️  (hint: set token in config or ${envVar} env var)`;
        }
        console.log(`    token:     ${tokenLine}`);

        if (localExists) {
          try {
            const hubFile = await loadHubFileConfig(hub.local);
            console.log(`    knowledge: ${hubFile.structure.knowledge_dir}  (index: ${hubFile.structure.index_file})`);
            console.log(`    absorb:    ${hubFile.absorb.strategy}  (batch: ${hubFile.absorb.batch_size})`);
          } catch {
            // skip if hub file can't be read
          }
        }

        console.log('');
      }
    });
}
