import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';
import { UserConfig, HubFileConfig, ResolvedHub } from './types.js';
import { DEFAULT_HUB_FILE_CONFIG } from './defaults.js';
import { KnowhubError, getErrorMessage } from '../utils/errors.js';

export function userConfigPath(): string {
  return path.join(os.homedir(), '.knowhub', 'config.yml');
}

export async function loadUserConfig(): Promise<UserConfig> {
  const configPath = userConfigPath();
  let raw: string;

  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { hubs: {} };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err: unknown) {
    throw new KnowhubError(
      `Malformed config file at ${configPath}: ${getErrorMessage(err)}`,
      1
    );
  }

  if (parsed === null || parsed === undefined) {
    return { hubs: {} };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new KnowhubError(`Malformed config file at ${configPath}: expected an object`, 1);
  }

  const obj = parsed as Record<string, unknown>;

  if (obj['hubs'] !== undefined && (typeof obj['hubs'] !== 'object' || Array.isArray(obj['hubs']))) {
    throw new KnowhubError(`Malformed config file at ${configPath}: 'hubs' must be an object`, 1);
  }

  return {
    default_hub: typeof obj['default_hub'] === 'string' ? obj['default_hub'] : undefined,
    hubs: (obj['hubs'] as Record<string, unknown> | undefined) != null
      ? (obj['hubs'] as Record<string, ReturnType<typeof Object>>)
      : {},
  } as UserConfig;
}

export async function loadHubFileConfig(localPath: string): Promise<HubFileConfig> {
  const hubFilePath = path.join(localPath, '.knowhub.yml');
  let raw: string;

  try {
    raw = await fs.readFile(hubFilePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        ...DEFAULT_HUB_FILE_CONFIG,
        structure: { ...DEFAULT_HUB_FILE_CONFIG.structure },
        absorb: { ...DEFAULT_HUB_FILE_CONFIG.absorb },
      };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err: unknown) {
    throw new KnowhubError(
      `Malformed hub config file at ${hubFilePath}: ${getErrorMessage(err)}`,
      1
    );
  }

  if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_HUB_FILE_CONFIG };
  }

  const obj = parsed as Record<string, unknown>;

  // Deep merge with defaults
  const defaults = DEFAULT_HUB_FILE_CONFIG;
  const structure = (obj['structure'] as Record<string, unknown> | undefined) ?? {};
  const absorb = (obj['absorb'] as Record<string, unknown> | undefined) ?? {};

  return {
    name: typeof obj['name'] === 'string' ? obj['name'] : defaults.name,
    description: typeof obj['description'] === 'string' ? obj['description'] : defaults.description,
    structure: {
      knowledge_dir: typeof structure['knowledge_dir'] === 'string'
        ? structure['knowledge_dir']
        : defaults.structure.knowledge_dir,
      index_file: typeof structure['index_file'] === 'string'
        ? structure['index_file']
        : defaults.structure.index_file,
    },
    absorb: {
      strategy: absorb['strategy'] === 'commit' || absorb['strategy'] === 'pr'
        ? absorb['strategy']
        : defaults.absorb.strategy,
      batch_size: typeof absorb['batch_size'] === 'number'
        ? absorb['batch_size']
        : defaults.absorb.batch_size,
      rules: typeof absorb['rules'] === 'string' ? absorb['rules'] : defaults.absorb.rules,
    },
  };
}

export async function resolveHub(hubNameOverride?: string): Promise<ResolvedHub> {
  const userConfig = await loadUserConfig();

  if (Object.keys(userConfig.hubs).length === 0) {
    throw new KnowhubError('No hubs configured', 1, 'Run `knowhub init` first');
  }

  let hubName: string;

  if (hubNameOverride !== undefined) {
    hubName = hubNameOverride;
  } else if (userConfig.default_hub !== undefined) {
    hubName = userConfig.default_hub;
  } else {
    hubName = Object.keys(userConfig.hubs)[0];
  }

  const hub = userConfig.hubs[hubName];
  if (hub === undefined) {
    throw new KnowhubError(`Hub '${hubName}' not found in config`, 1, 'Run `knowhub init` first');
  }

  const hubFile = await loadHubFileConfig(hub.local);

  return { name: hubName, hub, hubFile };
}
