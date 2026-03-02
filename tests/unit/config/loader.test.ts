import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises before importing the module under test
vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

// Import after mock registration
import { promises as fs } from 'fs';
import { loadUserConfig, loadHubFileConfig, resolveHub } from '../../../src/config/loader.js';
import { KnowhubError } from '../../../src/utils/errors.js';
import { DEFAULT_HUB_FILE_CONFIG } from '../../../src/config/defaults.js';

const mockReadFile = vi.mocked(fs.readFile);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// loadUserConfig
// ---------------------------------------------------------------------------

describe('loadUserConfig', () => {
  it('parses a valid config file', async () => {
    const yaml = `
default_hub: personal
hubs:
  personal:
    repo: testuser/my-learnings
    provider: github
    local: /tmp/test-hub
`.trim();

    mockReadFile.mockResolvedValueOnce(yaml as unknown as Buffer);

    const config = await loadUserConfig();

    expect(config.default_hub).toBe('personal');
    expect(config.hubs['personal']).toMatchObject({
      repo: 'testuser/my-learnings',
      provider: 'github',
      local: '/tmp/test-hub',
    });
  });

  it('returns { hubs: {} } when config file does not exist', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(err);

    const config = await loadUserConfig();

    expect(config).toEqual({ hubs: {} });
  });

  it('throws KnowhubError when config file contains malformed YAML', async () => {
    // Invalid YAML: mismatched indentation / bad structure
    const badYaml = `
hubs:
  personal:
    - invalid
    bad: [unclosed
`.trim();

    mockReadFile.mockResolvedValueOnce(badYaml as unknown as Buffer);

    await expect(loadUserConfig()).rejects.toThrow(KnowhubError);
  });
});

// ---------------------------------------------------------------------------
// loadHubFileConfig
// ---------------------------------------------------------------------------

describe('loadHubFileConfig', () => {
  it('returns defaults when hub file does not exist', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(err);

    const config = await loadHubFileConfig('/some/path');

    expect(config).toEqual(DEFAULT_HUB_FILE_CONFIG);
  });

  it('merges hub file values with defaults', async () => {
    const yaml = `
name: Test Hub
structure:
  knowledge_dir: knowledge/
  index_file: INDEX.md
absorb:
  strategy: commit
  batch_size: 10
`.trim();

    mockReadFile.mockResolvedValueOnce(yaml as unknown as Buffer);

    const config = await loadHubFileConfig('/some/path');

    expect(config.name).toBe('Test Hub');
    expect(config.absorb.batch_size).toBe(10);
    // rules not in fixture — should fall back to default
    expect(config.absorb.rules).toBe(DEFAULT_HUB_FILE_CONFIG.absorb.rules);
  });
});

// ---------------------------------------------------------------------------
// resolveHub
// ---------------------------------------------------------------------------

describe('resolveHub', () => {
  const validUserConfigYaml = `
default_hub: personal
hubs:
  personal:
    repo: testuser/my-learnings
    provider: github
    local: /tmp/test-hub
  work:
    repo: myorg/work-learnings
    provider: github
    local: /tmp/work-hub
`.trim();

  it('uses the provided override name', async () => {
    // First call: loadUserConfig reads ~/.knowhub/config.yml
    mockReadFile.mockResolvedValueOnce(validUserConfigYaml as unknown as Buffer);
    // Second call: loadHubFileConfig reads /tmp/work-hub/.knowhub.yml — not found
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(enoent);

    const resolved = await resolveHub('work');

    expect(resolved.name).toBe('work');
    expect(resolved.hub.repo).toBe('myorg/work-learnings');
  });

  it('uses default_hub from user config when no override is given', async () => {
    mockReadFile.mockResolvedValueOnce(validUserConfigYaml as unknown as Buffer);
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(enoent);

    const resolved = await resolveHub();

    expect(resolved.name).toBe('personal');
    expect(resolved.hub.repo).toBe('testuser/my-learnings');
  });

  it('uses first hub when no default_hub and no override', async () => {
    const noDefaultYaml = `
hubs:
  first:
    repo: user/first-hub
    provider: github
    local: /tmp/first-hub
`.trim();

    mockReadFile.mockResolvedValueOnce(noDefaultYaml as unknown as Buffer);
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(enoent);

    const resolved = await resolveHub();

    expect(resolved.name).toBe('first');
  });

  it('throws KnowhubError with hint when no hubs are configured', async () => {
    mockReadFile.mockResolvedValueOnce('hubs: {}' as unknown as Buffer);

    await expect(resolveHub()).rejects.toThrow(KnowhubError);

    try {
      // Reset and re-run to capture the hint message
      mockReadFile.mockResolvedValueOnce('hubs: {}' as unknown as Buffer);
      await resolveHub();
    } catch (err) {
      expect(err).toBeInstanceOf(KnowhubError);
      expect((err as KnowhubError).hint).toContain('knowhub init');
    }
  });
});
