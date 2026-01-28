/**
 * hop.json discovery, loading, and parsing.
 *
 * Resolution order (first match wins):
 * 1. ~/.hop/settings.json → { "hop_config": "/path/to/hop.json" } (authoritative pointer)
 * 2. HOP_CONFIG_PATH environment variable (CI/test override)
 * 3. ~/.hop/hop.json (default home — created by `hop init`)
 * 4. Walk up from cwd until hop.json found (project-level override)
 * 5. Legacy locations: ~/.config/hop/hop.json, /etc/hop/hop.json
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import type { HopConfig } from "./types.js";

const HOP_FILENAME = "hop.json";

/** The canonical home directory for HarnessOps configuration. */
export const HOP_DIR = join(homedir(), ".hop");

/** The default hop.json location — ~/.hop/hop.json */
export const HOP_DEFAULT_PATH = join(HOP_DIR, HOP_FILENAME);

/** Authoritative settings file — always checked first. */
const HOP_SETTINGS_PATH = join(HOP_DIR, "settings.json");

/** Legacy pointer file (config.json) — supported for backwards compatibility. */
const HOP_POINTER_CONFIG = join(HOP_DIR, "config.json");

interface HopSettings {
  hop_config: string;
}

interface HopPointerConfig {
  hop_config_path: string;
}

/**
 * Ensure ~/.hop/ exists. Called during init and set-path.
 */
export function ensureHopDir(): string {
  mkdirSync(HOP_DIR, { recursive: true });
  return HOP_DIR;
}

/**
 * Read ~/.hop/settings.json — the authoritative pointer to hop.json.
 */
function readSettings(): HopSettings | null {
  if (!existsSync(HOP_SETTINGS_PATH)) return null;
  try {
    const raw = readFileSync(HOP_SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as HopSettings;
  } catch {
    return null;
  }
}

/**
 * Read the legacy ~/.hop/config.json pointer file if it exists.
 */
function readPointerConfig(): HopPointerConfig | null {
  if (!existsSync(HOP_POINTER_CONFIG)) return null;
  try {
    const raw = readFileSync(HOP_POINTER_CONFIG, "utf-8");
    return JSON.parse(raw) as HopPointerConfig;
  } catch {
    return null;
  }
}

/**
 * Write ~/.hop/settings.json to pin the hop.json location.
 * Also writes legacy config.json for backwards compatibility.
 */
export function setConfigPath(hopJsonPath: string): string {
  const resolved = resolve(hopJsonPath);
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  ensureHopDir();
  // Write authoritative settings.json
  writeFileSync(
    HOP_SETTINGS_PATH,
    JSON.stringify({ hop_config: resolved }, null, 2) + "\n",
    "utf-8"
  );
  // Write legacy config.json for backwards compatibility
  writeFileSync(
    HOP_POINTER_CONFIG,
    JSON.stringify({ hop_config_path: resolved }, null, 2) + "\n",
    "utf-8"
  );
  return resolved;
}

export function discoverHopPath(startDir?: string): string | null {
  // 1. ~/.hop/settings.json (authoritative pointer — always checked first)
  const settings = readSettings();
  if (settings?.hop_config && existsSync(settings.hop_config)) {
    return resolve(settings.hop_config);
  }

  // 2. HOP_CONFIG_PATH environment variable (CI/tests/scripts override)
  const envPath = process.env.HOP_CONFIG_PATH;
  if (envPath && existsSync(envPath)) {
    return resolve(envPath);
  }

  // 3. ~/.hop/hop.json (the default home, created by `hop init`)
  if (existsSync(HOP_DEFAULT_PATH)) {
    return HOP_DEFAULT_PATH;
  }

  // 3b. Legacy ~/.hop/config.json pointer (backwards compat)
  const pointer = readPointerConfig();
  if (pointer?.hop_config_path && existsSync(pointer.hop_config_path)) {
    return resolve(pointer.hop_config_path);
  }

  // 4. Walk up from startDir or cwd (project-level override)
  let dir = startDir ? resolve(startDir) : process.cwd();
  while (true) {
    const candidate = join(dir, HOP_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 5. Legacy/system locations
  const legacyPaths = [
    join(homedir(), ".config", "hop", HOP_FILENAME),
    join("/etc", "hop", HOP_FILENAME),
  ];
  for (const p of legacyPaths) {
    if (existsSync(p)) {
      return resolve(p);
    }
  }

  return null;
}

export function loadHopConfig(filePath: string): HopConfig {
  const raw = readFileSync(filePath, "utf-8");
  const config: HopConfig = JSON.parse(raw);

  if (!config.schema_version) {
    throw new Error("hop.json missing required field: schema_version");
  }
  if (!config.machine?.id || !config.machine?.name) {
    throw new Error("hop.json missing required fields: machine.id and machine.name");
  }

  return config;
}

export function discoverAndLoad(startDir?: string): { config: HopConfig; path: string } | null {
  const hopPath = discoverHopPath(startDir);
  if (!hopPath) return null;
  return { config: loadHopConfig(hopPath), path: hopPath };
}
