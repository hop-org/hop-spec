/**
 * Helper utilities for working with HOP config data.
 */

import type { InfraRepoEntry, HopConfig, Project } from "./types.js";

/**
 * Normalize an infra repo entry (string or object) to a full InfraRepoEntry.
 */
export function normalizeInfraRepo(entry: string | InfraRepoEntry): InfraRepoEntry {
  if (typeof entry === "string") {
    return { name: entry };
  }
  return entry;
}

/**
 * Get the name of an infra repo entry regardless of format.
 */
export function infraRepoName(entry: string | InfraRepoEntry): string {
  return typeof entry === "string" ? entry : entry.name;
}

/**
 * Resolve the filesystem path for an infra repo by name.
 * Checks explicit path override first, then falls back to base path + name.
 * Returns undefined if not found or path cannot be resolved.
 */
export function resolveInfraRepoPath(config: HopConfig, name: string): string | undefined {
  const infra = config.infra_repos;
  if (!infra?.repos) return undefined;

  for (const entry of infra.repos) {
    const normalized = normalizeInfraRepo(entry);
    if (normalized.name !== name) continue;
    // Explicit path override on the entry
    if (normalized.path) return normalized.path;
    // Fall back to base path + name
    if (infra.path) return `${infra.path}/${name}`;
    return undefined;
  }

  return undefined;
}

/**
 * Collect all unique system identifiers from projects and infra repos.
 */
export function collectSystems(config: HopConfig): Map<string, { projects: Project[]; infraRepos: InfraRepoEntry[] }> {
  const systems = new Map<string, { projects: Project[]; infraRepos: InfraRepoEntry[] }>();

  const ensureSystem = (name: string) => {
    if (!systems.has(name)) {
      systems.set(name, { projects: [], infraRepos: [] });
    }
    return systems.get(name)!;
  };

  for (const project of config.projects ?? []) {
    if (project.system) {
      ensureSystem(project.system).projects.push(project);
    }
  }

  for (const repo of config.infra_repos?.repos ?? []) {
    const normalized = normalizeInfraRepo(repo);
    if (normalized.system) {
      ensureSystem(normalized.system).infraRepos.push(normalized);
    }
  }

  return systems;
}
