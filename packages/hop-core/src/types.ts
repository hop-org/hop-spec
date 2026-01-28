/**
 * TypeScript types for HarnessOps hop.json configuration.
 * Derived from spec/hop-schema.json (JSON Schema Draft 2020-12).
 */

export interface HopConfig {
  $schema?: string;
  schema_version: string;
  description?: string;
  machine: Machine;
  accounts?: Accounts;
  preferences?: Preferences;
  cross_project?: CrossProject;
  projects?: Project[];
  bundles?: Bundle[];
  infra_repos?: InfraRepos;
  scripts?: Record<string, string>;
  extensions?: Extensions;
  [key: string]: unknown;
}

export interface Machine {
  id: string;
  name: string;
  type?: "cloud-vps" | "cloud-vm" | "local-desktop" | "local-laptop" | "container" | "wsl";
  agent_root?: string;
  os?: "linux" | "darwin" | "windows";
  arch?: "x64" | "arm64" | "x86";
  [key: string]: unknown;
}

export interface Accounts {
  github?: GitHubAccount[];
  [key: string]: unknown[] | undefined;
}

export interface GitHubAccount {
  username: string;
  role?: string;
  default?: boolean;
  git_alias?: string;
  auth_method?: "ssh" | "https-pat" | "gh-cli" | "oauth";
  pat_bws_id?: string;
  active?: boolean;
  note?: string;
  [key: string]: unknown;
}

export interface Preferences {
  timezone?: string;
  timezone_abbreviation?: string;
  branch_patterns?: {
    feature?: string;
    beads_sync?: string;
    description?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

export interface CrossProject {
  home_project?: string;
  artifacts_path?: string;
  description?: string;
  [key: string]: unknown;
}

export interface Project {
  name: string;
  path?: string;
  type?: string;
  owner?: string;
  description?: string;
  system?: string;
  git?: GitConfig;
  account_override?: string;
  branch_checkouts?: Record<string, string>;
  note?: string;
  extensions?: Extensions;
  [key: string]: unknown;
}

export interface GitConfig {
  remote_url?: string;
  default_branch?: string;
  [key: string]: unknown;
}

export interface Bundle {
  id: string;
  name: string;
  description?: string;
  projects: string[];
  primary_project?: string;
  [key: string]: unknown;
}

export interface InfraRepoEntry {
  name: string;
  system?: string;
  description?: string;
  upstream?: string;
  [key: string]: unknown;
}

export interface InfraRepos {
  path?: string;
  readonly?: boolean;
  sync?: string;
  contribute?: {
    allowed?: boolean;
    requires_flags?: string[];
    [key: string]: unknown;
  };
  repos?: (string | InfraRepoEntry)[];
  [key: string]: unknown;
}

export interface Extensions {
  [key: string]: ExtensionEntry;
}

export interface ExtensionEntry {
  $schema?: string;
  enabled?: boolean;
  [key: string]: unknown;
}
