import { Command } from 'commander';
import { runAbsorb } from '../absorb/engine.js';
import { logger } from '../utils/logger.js';

export function makeAbsorbCommand(): Command {
  return new Command('absorb')
    .description('Synthesize captured learnings from issues into the knowledge base')
    .option('--hub <name>', 'Target hub (overrides config default)')
    .option('--dry-run', 'Show what would happen without making changes')
    .action(async (opts: { hub?: string; dryRun?: boolean }) => {
      const summary = await runAbsorb({ hubName: opts.hub, dryRun: opts.dryRun });

      if (!opts.dryRun) {
        logger.success(`Absorbed ${summary.issuesProcessed} issue${summary.issuesProcessed !== 1 ? 's' : ''}: ${summary.summary}`);
        if (summary.filesCreated > 0) logger.info(`  Created: ${summary.filesCreated} file${summary.filesCreated !== 1 ? 's' : ''}`);
        if (summary.filesUpdated > 0) logger.info(`  Updated: ${summary.filesUpdated} file${summary.filesUpdated !== 1 ? 's' : ''}`);
        if (summary.filesDeleted > 0) logger.info(`  Deleted: ${summary.filesDeleted} file${summary.filesDeleted !== 1 ? 's' : ''}`);
      }
    });
}
