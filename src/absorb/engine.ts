import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveHub, loadHubFileConfig } from '../config/loader.js';
import { getProvider } from '../providers/factory.js';
import { invokeClaudeForAbsorb, type AbsorbResult } from './claude.js';
import { generateIndex } from './index-generator.js';
import { gitAdd, gitCommit } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { KnowhubError } from '../utils/errors.js';
import type { Issue } from '../providers/types.js';

export interface AbsorbOptions {
  hubName?: string;
  dryRun?: boolean;
}

export interface AbsorbSummary {
  issuesProcessed: number;
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  summary: string;
}

async function readExistingFiles(knowledgeDir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  try {
    const entries = await fs.readdir(knowledgeDir);
    for (const entry of entries.filter(e => e.endsWith('.md'))) {
      files[entry] = await fs.readFile(join(knowledgeDir, entry), 'utf-8');
    }
  } catch {
    // directory doesn't exist yet
  }
  return files;
}

async function applyOperations(
  knowledgeDir: string,
  operations: AbsorbResult['operations'],
  dryRun: boolean
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Ensure knowledge dir exists
  if (!dryRun) {
    await fs.mkdir(knowledgeDir, { recursive: true });
  }

  for (const op of operations) {
    const filePath = join(knowledgeDir, op.path);
    if (op.action === 'create') {
      if (dryRun) {
        logger.info(`  [dry-run] would create: ${op.path}`);
      } else {
        await fs.writeFile(filePath, op.content!, 'utf-8');
        logger.success(`Created: ${op.path}`);
      }
      created++;
    } else if (op.action === 'update') {
      if (dryRun) {
        logger.info(`  [dry-run] would update: ${op.path}`);
      } else {
        await fs.writeFile(filePath, op.content!, 'utf-8');
        logger.success(`Updated: ${op.path}`);
      }
      updated++;
    } else if (op.action === 'delete') {
      if (dryRun) {
        logger.info(`  [dry-run] would delete: ${op.path}`);
      } else {
        try {
          await fs.unlink(filePath);
          logger.success(`Deleted: ${op.path}`);
        } catch {
          logger.warn(`Could not delete: ${op.path} (file may not exist)`);
        }
      }
      deleted++;
    }
  }

  return { created, updated, deleted };
}

export async function runAbsorb(options: AbsorbOptions = {}): Promise<AbsorbSummary> {
  const resolved = await resolveHub(options.hubName);
  const { hub } = resolved;

  if (!existsSync(hub.local)) {
    throw new KnowhubError(
      `Hub local path does not exist: ${hub.local}`,
      1,
      `Clone the hub repo first: git clone <repo-url> ${hub.local}`
    );
  }

  const hubFileConfig = await loadHubFileConfig(hub.local);
  const knowledgeDir = join(hub.local, hubFileConfig.structure.knowledge_dir);
  const provider = getProvider(hub);

  // Fetch open issues
  logger.info('Fetching open issues...');
  const issues: Issue[] = await provider.listIssues('open');

  if (issues.length === 0) {
    logger.info('No open issues to absorb.');
    return { issuesProcessed: 0, filesCreated: 0, filesUpdated: 0, filesDeleted: 0, summary: 'Nothing to absorb.' };
  }

  const batchSize = hubFileConfig.absorb.batch_size;
  const batch = issues.slice(0, batchSize);
  logger.info(`Processing ${batch.length} issue${batch.length !== 1 ? 's' : ''}...`);

  // Read existing knowledge files
  const existingFiles = await readExistingFiles(knowledgeDir);

  // Invoke Claude
  logger.info('Invoking Claude for synthesis...');
  const result = await invokeClaudeForAbsorb(batch, existingFiles, hubFileConfig);

  if (options.dryRun) {
    logger.info('\nDry run — no changes will be made:');
    logger.info(`  Summary: ${result.summary}`);
    await applyOperations(knowledgeDir, result.operations, true);
    return {
      issuesProcessed: batch.length,
      filesCreated: result.operations.filter(o => o.action === 'create').length,
      filesUpdated: result.operations.filter(o => o.action === 'update').length,
      filesDeleted: result.operations.filter(o => o.action === 'delete').length,
      summary: result.summary,
    };
  }

  // Apply file operations
  const counts = await applyOperations(knowledgeDir, result.operations, false);

  // Git commit knowledge changes
  if (counts.created + counts.updated + counts.deleted > 0) {
    gitAdd(hub.local, hubFileConfig.structure.knowledge_dir);
    gitCommit(hub.local, `knowhub: absorb ${batch.length} learning${batch.length !== 1 ? 's' : ''}`);
  }

  // Close processed issues
  logger.info('Closing processed issues...');
  for (const issue of batch) {
    await provider.closeIssue(issue.number);
    logger.debug(`Closed issue #${issue.number}`);
  }

  // Regenerate INDEX.md
  logger.info('Updating INDEX.md...');
  await generateIndex(hub.local, hubFileConfig);
  gitAdd(hub.local, hubFileConfig.structure.index_file);
  try {
    gitCommit(hub.local, 'knowhub: update INDEX.md');
  } catch {
    // INDEX.md may not have changed — that's okay
  }

  return {
    issuesProcessed: batch.length,
    filesCreated: counts.created,
    filesUpdated: counts.updated,
    filesDeleted: counts.deleted,
    summary: result.summary,
  };
}
