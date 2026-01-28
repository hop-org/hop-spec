export {
  discoverHopPath,
  loadHopConfig,
  discoverAndLoad,
  setConfigPath,
  ensureHopDir,
  HOP_DIR,
  HOP_DEFAULT_PATH,
} from "./discover.js";
export {
  normalizeInfraRepo,
  infraRepoName,
  collectSystems,
} from "./helpers.js";
export type {
  HopConfig,
  Machine,
  Accounts,
  GitHubAccount,
  Preferences,
  CrossProject,
  Project,
  GitConfig,
  Bundle,
  InfraRepoEntry,
  InfraRepos,
  Extensions,
  ExtensionEntry,
} from "./types.js";
