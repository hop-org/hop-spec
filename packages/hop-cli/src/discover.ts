import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import type { Project, HopConfig } from "@hop-org/hop-spec-core";
import { discoverAndLoad } from "@hop-org/hop-spec-core";

interface DiscoveredProject {
  name: string;
  path: string;
  type: string;
  git?: { remote_url?: string; default_branch?: string };
  markers: string[];
}

const PROJECT_MARKERS: Record<string, string> = {
  "package.json": "tool",
  "Cargo.toml": "tool",
  "pyproject.toml": "tool",
  "go.mod": "tool",
  "pom.xml": "tool",
  "build.gradle": "tool",
  "Gemfile": "tool",
  "mix.exs": "tool",
  "deno.json": "tool",
  "bun.lock": "tool",
};

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "target", ".venv", "venv",
  "__pycache__", ".tox", ".mypy_cache", ".pytest_cache", ".next",
  ".nuxt", "coverage", ".turbo", ".cache",
]);

function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

function getGitRemote(dir: string): string | undefined {
  try {
    const configPath = join(dir, ".git", "config");
    if (!existsSync(configPath)) return undefined;
    const content = readFileSync(configPath, "utf-8");
    const match = content.match(/\[remote "origin"\][^[]*url\s*=\s*(.+)/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

function getDefaultBranch(dir: string): string | undefined {
  try {
    const headPath = join(dir, ".git", "HEAD");
    if (!existsSync(headPath)) return undefined;
    const content = readFileSync(headPath, "utf-8").trim();
    const match = content.match(/^ref: refs\/heads\/(.+)$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function detectMarkers(dir: string): string[] {
  const markers: string[] = [];
  for (const marker of Object.keys(PROJECT_MARKERS)) {
    if (existsSync(join(dir, marker))) {
      markers.push(marker);
    }
  }
  return markers;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function scanDirectory(rootDir: string, maxDepth: number): DiscoveredProject[] {
  const results: DiscoveredProject[] = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    const dirName = basename(dir);
    if (SKIP_DIRS.has(dirName) && depth > 0) return;

    const hasGit = isGitRepo(dir);
    const markers = detectMarkers(dir);

    if (hasGit || markers.length > 0) {
      const project: DiscoveredProject = {
        name: toSlug(basename(dir)),
        path: resolve(dir),
        type: markers.length > 0 ? PROJECT_MARKERS[markers[0]] : "tool",
        markers: hasGit ? [".git", ...markers] : markers,
      };

      if (hasGit) {
        const remoteUrl = getGitRemote(dir);
        const defaultBranch = getDefaultBranch(dir);
        if (remoteUrl || defaultBranch) {
          project.git = {};
          if (remoteUrl) project.git.remote_url = remoteUrl;
          if (defaultBranch) project.git.default_branch = defaultBranch;
        }
      }

      results.push(project);
      // Don't recurse into git repos - they are self-contained projects
      if (hasGit) return;
    }

    // Recurse into subdirectories
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          walk(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Permission denied or other read error - skip
    }
  }

  walk(rootDir, 0);
  return results;
}

/**
 * Extract scan roots from a loaded HopConfig.
 * Uses machine.agent_root and infra_repos.path if available.
 */
function getScanRootsFromConfig(config: HopConfig): string[] {
  const roots: string[] = [];

  // machine.agent_root is the primary scan root
  if (config.machine.agent_root && existsSync(config.machine.agent_root)) {
    roots.push(resolve(config.machine.agent_root));
  }

  // First-class infra_repos.path
  if (config.infra_repos?.path && existsSync(config.infra_repos.path)) {
    roots.push(resolve(config.infra_repos.path));
  }

  // Fallback: extensions.infra-repos.path (legacy location)
  const extInfra = (config.extensions as any)?.["infra-repos"];
  if (extInfra?.path && existsSync(extInfra.path)) {
    const p = resolve(extInfra.path);
    if (!roots.includes(p)) roots.push(p);
  }

  return roots;
}

interface DiscoverOptions {
  dir?: string;
  depth?: number;
  json?: boolean;
  smart?: boolean;
}

export async function runDiscover(opts: DiscoverOptions): Promise<void> {
  const maxDepth = opts.depth ?? 3;
  let scanDirs: string[];

  if (opts.dir) {
    // Explicit directory — just scan it
    const dir = resolve(opts.dir);
    if (!existsSync(dir)) {
      console.error(`Error: Directory '${dir}' does not exist.`);
      process.exit(1);
    }
    scanDirs = [dir];
  } else {
    // Smart mode: try to use hop.json roots
    const loaded = discoverAndLoad();
    if (loaded) {
      const roots = getScanRootsFromConfig(loaded.config);
      if (roots.length > 0) {
        console.error(`Using roots from hop.json:`);
        for (const r of roots) console.error(`  • ${r}`);
        scanDirs = roots;
      } else {
        console.error(`hop.json found but no scan roots configured. Using cwd.`);
        scanDirs = [process.cwd()];
      }
    } else {
      scanDirs = [process.cwd()];
    }
  }

  const allProjects: DiscoveredProject[] = [];
  const seen = new Set<string>();

  for (const dir of scanDirs) {
    console.error(`Scanning ${dir} (depth: ${maxDepth})...`);
    const projects = scanDirectory(dir, maxDepth);
    for (const p of projects) {
      if (!seen.has(p.path)) {
        seen.add(p.path);
        allProjects.push(p);
      }
    }
  }

  if (allProjects.length === 0) {
    console.error("No projects found.");
    return;
  }

  console.error(`Found ${allProjects.length} project(s).\n`);

  if (opts.json) {
    // Output as hop.json-compatible project entries
    const hopProjects: Project[] = allProjects.map((p) => {
      const proj: Project = {
        name: p.name,
        path: p.path,
        type: p.type,
      };
      if (p.git) proj.git = p.git;
      return proj;
    });
    console.log(JSON.stringify(hopProjects, null, 2));
    return;
  }

  // Table output
  const nameWidth = Math.max(4, ...allProjects.map((p) => p.name.length));
  const hdr = "NAME".padEnd(nameWidth) + "  " + "MARKERS".padEnd(20) + "  PATH";
  console.log(hdr);
  const sep = "─".repeat(nameWidth) + "  " + "─".repeat(20) + "  " + "─".repeat(40);
  console.log(sep);
  for (const p of allProjects) {
    const line = p.name.padEnd(nameWidth) + "  " + p.markers.join(", ").padEnd(20) + "  " + p.path;
    console.log(line);
  }
}
