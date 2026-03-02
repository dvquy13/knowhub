export interface HubConfig {
  repo: string;          // "owner/repo" or full GitLab URL
  provider: 'github' | 'gitlab';
  local: string;         // absolute path to local clone
  token?: string;        // PAT (can also come from env)
}

export interface UserConfig {
  default_hub?: string;
  hubs: Record<string, HubConfig>;
}

export interface HubFileConfig {
  name: string;
  description?: string;
  structure: {
    knowledge_dir: string;
    index_file: string;
  };
  absorb: {
    strategy: 'commit' | 'pr';
    batch_size: number;
    rules?: string;
  };
}

export interface ResolvedHub {
  name: string;
  hub: HubConfig;
  hubFile?: HubFileConfig;  // loaded from local/.knowhub.yml if present
}
