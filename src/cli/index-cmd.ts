import { Command } from 'commander';
import { resolveHub, loadHubFileConfig } from '../config/loader.js';
import { generateIndex } from '../absorb/index-generator.js';
import { logger } from '../utils/logger.js';
import { KnowhubError } from '../utils/errors.js';
import { existsSync } from 'fs';

export function makeIndexCommand(): Command {
  return new Command('index')
    .description('Regenerate INDEX.md from current knowledge files')
    .option('--hub <name>', 'Target hub (overrides config default)')
    .action(async (opts: { hub?: string }) => {
      const resolved = await resolveHub(opts.hub);

      if (!existsSync(resolved.hub.local)) {
        throw new KnowhubError(
          `Hub local path does not exist: ${resolved.hub.local}`,
          1,
          `Clone the hub repo to ${resolved.hub.local} first`
        );
      }

      const hubFileConfig = await loadHubFileConfig(resolved.hub.local);
      const indexPath = await generateIndex(resolved.hub.local, hubFileConfig);

      logger.success(`INDEX.md written to ${indexPath}`);
    });
}
