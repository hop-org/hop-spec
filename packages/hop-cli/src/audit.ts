/**
 * hop audit — Reconcile hop.json against filesystem reality.
 *
 * Managed directories (machine.agent_root, infra_repos.path) are directories
 * where every child is expected to be accounted for in hop.json.  Any child
 * directory not registered as a project or infra repo is an "orphan".
 *
 * Additionally checks:
 *   - Registered projects whose paths don't exist on disk ("stale").
 *   - (--scan) Git repos outside managed dirs that aren't registered.
 */

import { readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import type { HopConfig } from "@hop-org/hop-spec-core";
import { infraRepoName } from "@hop-org/hop-spec-core";

// Directories to always skip when scanning
const SKIP_NAMES = new Set([
  "node_modules", ".git", "dist", "build", "target", ".venv", "venv",
  "__pycache__", ".cache", ".npm", ".nvm", ".bun", ".local",
  ".config", ".ssh", ".gnupg", "snap",
]);

export interface AuditResult {
  orphans: AuditEntry[];
  stale: AuditEntry[];
  strays: AuditEntry[];
  managed_dirs: string[];
}

export interface AuditEntry {
  name: string;
  path: string;
  source: string;       // which managed dir or "filesystem"
  has_git: boolean;
}

/**
 * Collect all paths that hop.json accounts for (projects + infra repos).
 */
function getRegisteredPaths(config: HopConfig): Set<string> {
  const paths = new Set<string>();

  // Projects with paths
  for (const p of config.projects ?? []) {
    if (p.path) paths.add(resolve(p.path));
  }

  // Infra repos resolved against infra_repos.path
  const infraBase = config.infra_repos?.path;
  if (infraBase) {
    for (const entry of config.infra_repos?.repos ?? []) {
      const name = infraRepoName(entry);
      paths.add(resolve(join(infraBase, name)));
    }
  }

  return paths;
}

/**
 * Get the managed directories from hop.json.
 * These are dirs where every child is expected to be registered.
 */
function getManagedDirs(config: HopConfig): string[] {
  const dirs: string[] = [];

  // machine.agent_root is the primary managed directory
  if (config.machine.agent_root) {
    const p = resolve(config.machine.agent_root);
    if (existsSync(p)) dirs.push(p);
  }

  // infra_repos.path is a managed directory
  if (config.infra_repos?.path) {
    const p = resolve(config.infra_repos.path);
    if (existsSync(p) && !dirs.includes(p)) dirs.push(p);
  }

  return dirs;
}

/**
 * List immediate child directories of a path.
 */
function listChildDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith(".") && !SKIP_NAMES.has(e.name))
      .map(e => resolve(join(dir, e.name)));
  } catch {
    return [];
  }
}

/**
 * Check if a directory contains a .git subdirectory.
 */
function hasGit(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/**
 * Scan for git repos outside managed directories (breadth-first, max depth 2).
 */
function scanForStrays(
  config: HopConfig,
  registeredPaths: Set<string>,
  managedDirs: string[]
): AuditEntry[] {
  const strays: AuditEntry[] = [];
  const home = homedir();
  const managedSet = new Set(managedDirs);

  // Scan home directory children (depth 1), skip managed dirs
  const homeDirs = listChildDirs(home);
  for (const dir of homeDirs) {
    if (managedSet.has(dir)) continue;

    // Check the dir itself
    if (hasGit(dir) && !registeredPaths.has(dir)) {
      strays.push({
        name: basename(dir),
        path: dir,
        source: "~/" + basename(dir),
        has_git: true,
      });
      continue; // don't recurse into git repos
    }

    // Check one level deeper (depth 2)
    const subDirs = listChildDirs(dir);
    for (const sub of subDirs) {
      if (managedSet.has(sub)) continue;
      if (hasGit(sub) && !registeredPaths.has(sub)) {
        strays.push({
          name: basename(sub),
          path: sub,
          source: "~/" + basename(dir) + "/" + basename(sub),
          has_git: true,
        });
      }
    }
  }

  return strays;
}

export interface AuditOptions {
  json?: boolean;
  scan?: boolean;
}

export async function runAudit(config: HopConfig, opts: AuditOptions): Promise<void> {
  const registeredPaths = getRegisteredPaths(config);
  const managedDirs = getManagedDirs(config);
  const result: AuditResult = {
    orphans: [],
    stale: [],
    strays: [],
    managed_dirs: managedDirs,
  };

  // --- Orphan check: children of managed dirs not in registry ---
  for (const managedDir of managedDirs) {
    const children = listChildDirs(managedDir);
    for (const child of children) {
      if (!registeredPaths.has(child)) {
        result.orphans.push({
          name: basename(child),
          path: child,
          source: managedDir,
          has_git: hasGit(child),
        });
      }
    }
  }

  // --- Stale check: registered paths that don't exist on disk ---
  for (const p of config.projects ?? []) {
    if (p.path && !existsSync(p.path)) {
      result.stale.push({
        name: p.name,
        path: p.path,
        source: "projects",
        has_git: false,
      });
    }
  }

  // --- Stray scan: git repos outside managed dirs (optional) ---
  if (opts.scan) {
    result.strays = scanForStrays(config, registeredPaths, managedDirs);
  }

  // --- Output ---
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output
  const totalIssues = result.orphans.length + result.stale.length + result.strays.length;

  if (totalIssues === 0) {
    console.log("All clear — no orphans, stale entries, or strays found.");
    return;
  }

  // Managed directories
  console.log(`Managed directories: ${managedDirs.join(", ")}`);
  console.log("");

  // Orphans
  if (result.orphans.length > 0) {
    console.log(`Orphans (${result.orphans.length}): directories in managed dirs not registered in hop.json`);
    const nameWidth = Math.max(4, ...result.orphans.map(o => o.name.length));
    console.log(`  ${"NAME".padEnd(nameWidth)}  GIT  PATH`);
    console.log(`  ${"─".repeat(nameWidth)}  ${"─".repeat(3)}  ${"─".repeat(40)}`);
    for (const o of result.orphans) {
      console.log(`  ${o.name.padEnd(nameWidth)}  ${o.has_git ? "yes" : " - "}  ${o.path}`);
    }
    console.log("");
  }

  // Stale
  if (result.stale.length > 0) {
    console.log(`Stale (${result.stale.length}): registered projects whose paths don't exist on disk`);
    for (const s of result.stale) {
      console.log(`  ${s.name}  ->  ${s.path}`);
    }
    console.log("");
  }

  // Strays
  if (result.strays.length > 0) {
    console.log(`Strays (${result.strays.length}): git repos outside managed dirs not in hop.json`);
    const nameWidth = Math.max(4, ...result.strays.map(s => s.name.length));
    console.log(`  ${"NAME".padEnd(nameWidth)}  PATH`);
    console.log(`  ${"─".repeat(nameWidth)}  ${"─".repeat(40)}`);
    for (const s of result.strays) {
      console.log(`  ${s.name.padEnd(nameWidth)}  ${s.path}`);
    }
    console.log("");
  }

  // Summary
  console.log(`Summary: ${result.orphans.length} orphans, ${result.stale.length} stale, ${result.strays.length} strays`);

  // Exit with non-zero if issues found (useful for CI/scripting)
  if (result.orphans.length > 0 || result.stale.length > 0) {
    process.exitCode = 1;
  }
}
