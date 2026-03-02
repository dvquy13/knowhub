import { promises as fs } from 'fs';
import * as path from 'path';
import { stringify } from 'yaml';
import { UserConfig, HubFileConfig } from './types.js';
import { userConfigPath } from './loader.js';

export async function writeUserConfig(config: UserConfig): Promise<void> {
  const configPath = userConfigPath();
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, stringify(config), 'utf-8');
}

export async function writeHubFileConfig(localPath: string, config: HubFileConfig): Promise<void> {
  const hubFilePath = path.join(localPath, '.knowhub.yml');
  const dir = path.dirname(hubFilePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(hubFilePath, stringify(config), 'utf-8');
}
