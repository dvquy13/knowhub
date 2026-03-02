import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing module under test
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import { resolveInvoker, buildAbsorbPrompt, parseAbsorbResponse } from '../../../src/absorb/claude.js';
import { KnowhubError } from '../../../src/utils/errors.js';
import type { Issue } from '../../../src/providers/types.js';
import type { HubFileConfig } from '../../../src/config/types.js';

const mockExecSync = vi.mocked(execSync);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleIssues: Issue[] = [
  {
    id: 1,
    number: 42,
    title: 'TypeScript generics patterns',
    body: 'Use generics to create reusable components.',
    labels: ['learning'],
    createdAt: '2026-01-01T00:00:00Z',
    url: 'https://github.com/user/repo/issues/42',
  },
  {
    id: 2,
    number: 43,
    title: 'Async error handling',
    body: 'Always use try/catch with await.',
    labels: ['learning'],
    createdAt: '2026-01-02T00:00:00Z',
    url: 'https://github.com/user/repo/issues/43',
  },
];

const sampleHubConfig: HubFileConfig = {
  name: 'My Learning Hub',
  description: 'Personal learnings',
  structure: {
    knowledge_dir: 'knowledge/',
    index_file: 'INDEX.md',
  },
  absorb: {
    strategy: 'commit',
    batch_size: 10,
    rules: 'Group by language and topic.',
  },
};

const validAbsorbJson = JSON.stringify({
  operations: [
    {
      action: 'create',
      path: 'typescript.md',
      content: '# TypeScript\n\n## Summary\nKey TypeScript patterns.',
    },
  ],
  summary: 'Created typescript.md with generics and async patterns.',
});

// ---------------------------------------------------------------------------
// resolveInvoker
// ---------------------------------------------------------------------------

describe('resolveInvoker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns claude-cli when execSync succeeds for claude --version', () => {
    mockExecSync.mockReturnValueOnce('claude 1.0.0' as unknown as ReturnType<typeof execSync>);

    const result = resolveInvoker();

    expect(result).toBe('claude-cli');
    expect(mockExecSync).toHaveBeenCalledWith('claude --version', { stdio: 'pipe' });
  });

  it('returns anthropic-sdk when claude CLI fails but ANTHROPIC_API_KEY is set', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('command not found: claude');
    });
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

    const result = resolveInvoker();

    expect(result).toBe('anthropic-sdk');
  });

  it('throws KnowhubError when neither claude CLI nor ANTHROPIC_API_KEY is available', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('command not found: claude');
    });
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    expect(() => resolveInvoker()).toThrow(KnowhubError);

    // Verify the error carries a helpful hint
    try {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('command not found: claude');
      });
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      resolveInvoker();
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      expect((err as KnowhubError).hint).toContain('ANTHROPIC_API_KEY');
    }
  });
});

// ---------------------------------------------------------------------------
// buildAbsorbPrompt
// ---------------------------------------------------------------------------

describe('buildAbsorbPrompt', () => {
  it('includes issue titles and bodies in output', () => {
    const prompt = buildAbsorbPrompt(sampleIssues, {}, sampleHubConfig);

    expect(prompt).toContain('Issue #42: TypeScript generics patterns');
    expect(prompt).toContain('Use generics to create reusable components.');
    expect(prompt).toContain('Issue #43: Async error handling');
    expect(prompt).toContain('Always use try/catch with await.');
  });

  it('includes existing file content in the prompt', () => {
    const existingFiles = {
      'typescript.md': '# TypeScript\n\n## Summary\nExisting content.',
    };

    const prompt = buildAbsorbPrompt(sampleIssues, existingFiles, sampleHubConfig);

    expect(prompt).toContain('typescript.md');
    expect(prompt).toContain('Existing content.');
  });

  it('shows placeholder when no existing files are present', () => {
    const prompt = buildAbsorbPrompt(sampleIssues, {}, sampleHubConfig);

    expect(prompt).toContain('_No existing knowledge files yet._');
  });

  it('includes hub rules from config', () => {
    const prompt = buildAbsorbPrompt(sampleIssues, {}, sampleHubConfig);

    expect(prompt).toContain('Group by language and topic.');
  });

  it('falls back to default rules when none are set in config', () => {
    const configWithoutRules: HubFileConfig = {
      ...sampleHubConfig,
      absorb: { ...sampleHubConfig.absorb, rules: undefined },
    };

    const prompt = buildAbsorbPrompt(sampleIssues, {}, configWithoutRules);

    expect(prompt).toContain('Organize by topic. One file per major topic.');
  });

  it('includes hub name and description', () => {
    const prompt = buildAbsorbPrompt(sampleIssues, {}, sampleHubConfig);

    expect(prompt).toContain('My Learning Hub');
    expect(prompt).toContain('Personal learnings');
  });
});

// ---------------------------------------------------------------------------
// parseAbsorbResponse
// ---------------------------------------------------------------------------

describe('parseAbsorbResponse', () => {
  it('parses valid JSON correctly', () => {
    const result = parseAbsorbResponse(validAbsorbJson);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toEqual({
      action: 'create',
      path: 'typescript.md',
      content: '# TypeScript\n\n## Summary\nKey TypeScript patterns.',
    });
    expect(result.summary).toBe('Created typescript.md with generics and async patterns.');
  });

  it('strips markdown code blocks before parsing', () => {
    const wrappedInCodeBlock = `\`\`\`json\n${validAbsorbJson}\n\`\`\``;

    const result = parseAbsorbResponse(wrappedInCodeBlock);

    expect(result.operations).toHaveLength(1);
    expect(result.summary).toBe('Created typescript.md with generics and async patterns.');
  });

  it('strips plain code blocks (no language tag) before parsing', () => {
    const wrappedInPlainBlock = `\`\`\`\n${validAbsorbJson}\n\`\`\``;

    const result = parseAbsorbResponse(wrappedInPlainBlock);

    expect(result.summary).toBe('Created typescript.md with generics and async patterns.');
  });

  it('throws KnowhubError on invalid JSON', () => {
    expect(() => parseAbsorbResponse('this is not json')).toThrow(KnowhubError);

    try {
      parseAbsorbResponse('this is not json');
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      expect((err as KnowhubError).message).toContain('invalid JSON');
    }
  });

  it('throws KnowhubError when operations field is missing', () => {
    const noOperations = JSON.stringify({ summary: 'Done.' });

    expect(() => parseAbsorbResponse(noOperations)).toThrow(KnowhubError);

    try {
      parseAbsorbResponse(noOperations);
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      expect((err as KnowhubError).message).toContain('operations');
    }
  });

  it('throws KnowhubError when summary field is missing', () => {
    const noSummary = JSON.stringify({
      operations: [{ action: 'create', path: 'a.md', content: '# A' }],
    });

    expect(() => parseAbsorbResponse(noSummary)).toThrow(KnowhubError);
  });

  it('throws KnowhubError when an operation has an invalid action', () => {
    const invalidAction = JSON.stringify({
      operations: [{ action: 'replace', path: 'a.md', content: '# A' }],
      summary: 'Done.',
    });

    expect(() => parseAbsorbResponse(invalidAction)).toThrow(KnowhubError);

    try {
      parseAbsorbResponse(invalidAction);
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      expect((err as KnowhubError).message).toContain('replace');
    }
  });

  it('throws KnowhubError when a create operation is missing content', () => {
    const missingContent = JSON.stringify({
      operations: [{ action: 'create', path: 'a.md' }],
      summary: 'Done.',
    });

    expect(() => parseAbsorbResponse(missingContent)).toThrow(KnowhubError);
  });

  it('accepts delete operations without content', () => {
    const deleteOp = JSON.stringify({
      operations: [{ action: 'delete', path: 'old.md' }],
      summary: 'Deleted old.md.',
    });

    const result = parseAbsorbResponse(deleteOp);

    expect(result.operations[0].action).toBe('delete');
    expect(result.operations[0].path).toBe('old.md');
  });

  it('handles multiple mixed operations', () => {
    const multiOp = JSON.stringify({
      operations: [
        { action: 'create', path: 'new.md', content: '# New' },
        { action: 'update', path: 'existing.md', content: '# Updated' },
        { action: 'delete', path: 'stale.md' },
      ],
      summary: 'Reorganized knowledge base.',
    });

    const result = parseAbsorbResponse(multiOp);

    expect(result.operations).toHaveLength(3);
    expect(result.summary).toBe('Reorganized knowledge base.');
  });
});
