#!/usr/bin/env node
import { Command } from 'commander';
import { setDebug } from './utils/logger.js';
import { KnowhubError, getErrorMessage } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { makeCaptureCommand } from './cli/capture.js';
import { makeIndexCommand } from './cli/index-cmd.js';
import { makeAbsorbCommand } from './cli/absorb.js';
import { makeInitCommand } from './cli/init.js';
import { makeStatusCommand } from './cli/status.js';

const program = new Command();

program
  .name('knowhub')
  .description('Personal knowledge hub — capture learnings, synthesize into curated markdown via Claude')
  .version('0.1.0')
  .option('--hub <name>', 'target hub (overrides default_hub in config)')
  .option('--verbose', 'enable verbose/debug output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) setDebug(true);
  });

// Commands registered by milestone modules
// M3: capture
// M4: index
// M6: absorb
// M7: init
program.addCommand(makeCaptureCommand());
program.addCommand(makeIndexCommand());
program.addCommand(makeAbsorbCommand());
program.addCommand(makeInitCommand());
program.addCommand(makeStatusCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof KnowhubError) {
    logger.error(err.message);
    if (err.hint) {
      logger.info(`  Hint: ${err.hint}`);
    }
    process.exit(err.exitCode);
  }
  logger.error(getErrorMessage(err));
  process.exit(1);
});
