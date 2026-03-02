import { HubFileConfig } from './types.js';

export const DEFAULT_HUB_FILE_CONFIG: HubFileConfig = {
  name: 'My Knowledge Hub',
  description: 'Personal knowledge hub',
  structure: {
    knowledge_dir: 'knowledge/',
    index_file: 'INDEX.md',
  },
  absorb: {
    strategy: 'commit',
    batch_size: 20,
    rules: 'Organize by topic. One file per major topic. Prefer updating existing files over creating new ones. Each file should have a clear ## Summary at the top. Use practical, actionable language.',
  },
};
