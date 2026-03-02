import { Command } from 'commander';
import { resolveHub } from '../config/loader.js';
import { getProvider } from '../providers/factory.js';
import { logger } from '../utils/logger.js';

export function makeCaptureCommand(): Command {
  return new Command('capture')
    .description('Capture a learning as a new issue in the hub')
    .argument('<learning>', 'The learning to capture (becomes the issue body)')
    .option('--title <title>', 'Issue title (defaults to first line of learning)')
    .option('--labels <labels>', 'Comma-separated labels to apply')
    .option('--hub <name>', 'Target hub (overrides config default)')
    .action(async (learning: string, opts: { title?: string; labels?: string; hub?: string }) => {
      const resolved = await resolveHub(opts.hub);
      const provider = getProvider(resolved.hub);

      const title = opts.title ?? learning.split('\n')[0].slice(0, 100);
      const labels = opts.labels ? opts.labels.split(',').map(l => l.trim()) : ['learning'];

      const issue = await provider.createIssue(title, learning, labels);

      logger.success(`Captured: ${issue.url}`);
    });
}
