import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateIndex } from '../../../src/absorb/index-generator.js';
import type { HubFileConfig } from '../../../src/config/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'knowhub-test-'));
}

function makeHubFileConfig(overrides: Partial<HubFileConfig> = {}): HubFileConfig {
  return {
    name: 'Test Hub',
    structure: {
      knowledge_dir: 'knowledge',
      index_file: 'INDEX.md',
    },
    absorb: {
      strategy: 'commit',
      batch_size: 5,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateIndex', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates index with "No knowledge files yet" when knowledge dir is empty', async () => {
    // Create an empty knowledge dir
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('No knowledge files yet');
    expect(content).toContain('**0 topics**');
    expect(indexPath).toBe(path.join(tmpDir, 'INDEX.md'));
  });

  it('generates index with "No knowledge files yet" when knowledge dir does not exist', async () => {
    // Do NOT create the knowledge dir — scanKnowledgeDir should handle the missing dir gracefully
    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('No knowledge files yet');
    expect(content).toContain('**0 topics**');
  });

  it('extracts title and summary from a file with # heading and ## Summary section', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    await fs.writeFile(
      path.join(knowledgeDir, 'typescript.md'),
      [
        '# TypeScript Tips',
        '',
        '## Summary',
        'Key TypeScript patterns and gotchas.',
        '',
        '## Type Guards',
        'Use `typeof` and `instanceof` for runtime type checking.',
      ].join('\n'),
      'utf-8'
    );

    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('## [TypeScript Tips](typescript.md)');
    expect(content).toContain('Key TypeScript patterns and gotchas.');
    expect(content).toContain('**1 topic**');
  });

  it('includes all .md files sorted alphabetically', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    await fs.writeFile(
      path.join(knowledgeDir, 'typescript.md'),
      '# TypeScript Tips\n\n## Summary\nTypeScript summary.\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(knowledgeDir, 'git.md'),
      '# Git Workflows\n\n## Summary\nGit summary.\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(knowledgeDir, 'docker.md'),
      '# Docker Basics\n\n## Summary\nDocker summary.\n',
      'utf-8'
    );

    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');

    // All three should appear
    expect(content).toContain('## [Docker Basics](docker.md)');
    expect(content).toContain('## [Git Workflows](git.md)');
    expect(content).toContain('## [TypeScript Tips](typescript.md)');
    expect(content).toContain('**3 topics**');

    // Verify alphabetical order: docker < git < typescript
    const dockerPos = content.indexOf('docker.md');
    const gitPos = content.indexOf('git.md');
    const tsPos = content.indexOf('typescript.md');
    expect(dockerPos).toBeLessThan(gitPos);
    expect(gitPos).toBeLessThan(tsPos);
  });

  it('uses "Untitled" as title when .md file has no # heading', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    await fs.writeFile(
      path.join(knowledgeDir, 'no-heading.md'),
      'This file has no heading.\n\nJust a plain paragraph.\n',
      'utf-8'
    );

    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('## [Untitled](no-heading.md)');
  });

  it('falls back to first paragraph when no ## Summary section exists', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    await fs.writeFile(
      path.join(knowledgeDir, 'no-summary.md'),
      [
        '# No Summary File',
        '',
        'This is the first paragraph of content.',
        'It spans multiple lines.',
        '',
        '## Details',
        'Some detail here.',
      ].join('\n'),
      'utf-8'
    );

    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('## [No Summary File](no-summary.md)');
    expect(content).toContain('This is the first paragraph of content.');
    // Should NOT contain the details section content as the summary
    expect(content).not.toContain('Some detail here.');
  });

  it('excludes INDEX.md from the list of knowledge files', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    // Place INDEX.md inside the knowledge dir (edge case: same basename as index_file)
    await fs.writeFile(
      path.join(knowledgeDir, 'INDEX.md'),
      '# Index\n\nSome old index content.\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(knowledgeDir, 'topic.md'),
      '# Real Topic\n\n## Summary\nReal content.\n',
      'utf-8'
    );

    const config = makeHubFileConfig();
    const indexPath = await generateIndex(tmpDir, config);

    const content = await fs.readFile(indexPath, 'utf-8');
    // INDEX.md should not be listed as a topic entry
    expect(content).not.toContain('## [Index](INDEX.md)');
    expect(content).toContain('## [Real Topic](topic.md)');
    expect(content).toContain('**1 topic**');
  });

  it('writes the index file to the configured index_file path', async () => {
    const knowledgeDir = path.join(tmpDir, 'docs');
    await fs.mkdir(knowledgeDir);

    const config = makeHubFileConfig({
      structure: {
        knowledge_dir: 'docs',
        index_file: 'docs/INDEX.md',
      },
    });

    const indexPath = await generateIndex(tmpDir, config);

    expect(indexPath).toBe(path.join(tmpDir, 'docs/INDEX.md'));
    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('# Test Hub — Knowledge Index');
  });

  it('includes hub name in the index heading', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    const config = makeHubFileConfig({ name: 'My Personal Hub' });
    await generateIndex(tmpDir, config);

    const content = await fs.readFile(path.join(tmpDir, 'INDEX.md'), 'utf-8');
    expect(content).toContain('# My Personal Hub — Knowledge Index');
  });

  it('includes a last updated date in the footer', async () => {
    const knowledgeDir = path.join(tmpDir, 'knowledge');
    await fs.mkdir(knowledgeDir);

    const config = makeHubFileConfig();
    await generateIndex(tmpDir, config);

    const content = await fs.readFile(path.join(tmpDir, 'INDEX.md'), 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    expect(content).toContain(`_Last updated: ${today}_`);
  });
});
