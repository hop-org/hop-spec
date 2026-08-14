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
  services?: Services;
  harnesses?: Harness[];
  runtimes?: Runtime[];
  [key: string]: unknown;
}

/**
 * An installed program this machine can run.
 *
 * Location and ownership only. `manager` is the field that matters most in
 * practice: it tells an agent whether a path is safe to relocate, since moving
 * anything package-managed breaks its upgrade path.
 *
 * Makes no assumption about privilege — `entrypoint` records whatever actually
 * works here, whether that is a shim script, a package-manager symlink, or a
 * raw path inside a package directory.
 */
export interface Runtime {
  name: string;
  /** Path to invoke. Mechanism-agnostic. */
  entrypoint?: string;
  /** Directory holding the program itself, when different from the entrypoint. */
  payload?: string;
  /** Directory holding this runtime's config and state. */
  config?: string;
  /** What installs and updates this — winget, npm, bun, manual, self-built, os. */
  manager?: string;
  /** Command that updates it in place. */
  upgrade?: string;
  [key: string]: unknown;
}

/**
 * An agent harness installed on this machine, described by where it keeps its
 * configuration. Location only — HarnessOps does not govern what MCP servers or
 * skills a harness has active, only where to look to find out.
 */
export interface Harness {
  name: string;
  /** Harness family; unrecognised values are reported unparsed rather than failing. */
  type?: string;
  /** Primary config file (for claude-code, ~/.claude.json — holds machine MCP servers). */
  config?: string;
  /** User settings file, when kept separately from config. */
  settings?: string;
  /** Directory holding installed plugins and known marketplaces. */
  plugins?: string;
  /** Directories searched for skills; an array because several are common. */
  skills?: string[];
  /**
   * True when this harness can also load MCP servers provisioned against the
   * user's account. Those never appear on disk, so anything reporting local
   * findings must disclose them rather than implying completeness.
   */
  account_scoped?: boolean;
  note?: string;
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
  path?: string;
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

/**
 * Running infrastructure services that agents discover at runtime.
 * Unlike extensions (tool config), services represent live endpoints.
 */
export interface Services {
  [key: string]: Service;
}

export interface Service {
  /** HTTP(S) endpoint for the service */
  url?: string;
  /** CLI binary name or path if the service is invoked as a process */
  binary?: string;
  /** Environment variable name holding the auth token */
  token_env?: string;
  /** Human-readable description */
  description?: string;
  [key: string]: unknown;
}
