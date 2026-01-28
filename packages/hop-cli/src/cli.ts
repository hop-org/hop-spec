#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { discoverAndLoad, discoverHopPath, setConfigPath, collectSystems, normalizeInfraRepo, infraRepoName } from "@harnessops/core";
import type { HopConfig } from "@harnessops/core";
import { runInit } from "./init.js";
import { runValidate } from "./validate.js";
import { runDiscover } from "./discover.js";

const program = new Command();

program
  .name("hop")
  .description("HarnessOps CLI — query and manage hop.json configurations")
  .version("0.1.0");

/**
 * Helper: discover and load hop.json, or exit with error.
 */
function loadOrExit(): { config: HopConfig; path: string } {
  try {
    const result = discoverAndLoad();
    if (!result) {
      console.error("Error: No hop.json found.");
      console.error("Searched: ~/.hop/settings.json, $HOP_CONFIG_PATH, ~/.hop/hop.json, parent directories");
      console.error("Run 'hop init' to create ~/.hop/hop.json");
      process.exit(1);
      throw new Error("unreachable"); // for type narrowing
    }
    return result;
  } catch (err) {
    console.error("Error: Failed to load hop.json.");
    if (err instanceof Error && err.message) {
      console.error(err.message);
    }
    process.exit(1);
    throw new Error("unreachable"); // for type narrowing
  }
}

// --- hop projects ---
program
  .command("projects")
  .description("List all projects defined in hop.json")
  .option("--json", "Output as JSON")
  .option("-t, --type <type>", "Filter by project type")
  .option("-s, --system <system>", "Filter by system identifier")
  .action((opts) => {
    const { config } = loadOrExit();
    let projects = config.projects ?? [];

    if (opts.type) {
      projects = projects.filter((p) => p.type === opts.type);
    }
    if (opts.system) {
      projects = projects.filter((p) => p.system === opts.system);
    }

    if (opts.json) {
      console.log(JSON.stringify(projects, null, 2));
      return;
    }

    if (projects.length === 0) {
      console.log("No projects found.");
      return;
    }

    // Check if any project has a system field
    const hasSystem = projects.some((p) => p.system);

    // Table output
    const nameWidth = Math.max(4, ...projects.map((p) => p.name.length));
    const typeWidth = Math.max(4, ...projects.map((p) => (p.type ?? "").length));
    const systemWidth = hasSystem ? Math.max(6, ...projects.map((p) => (p.system ?? "").length)) : 0;

    if (hasSystem) {
      console.log(
        `${"NAME".padEnd(nameWidth)}  ${"TYPE".padEnd(typeWidth)}  ${"SYSTEM".padEnd(systemWidth)}  PATH`
      );
      console.log(`${"─".repeat(nameWidth)}  ${"─".repeat(typeWidth)}  ${"─".repeat(systemWidth)}  ${"─".repeat(40)}`);
      for (const p of projects) {
        console.log(
          `${p.name.padEnd(nameWidth)}  ${(p.type ?? "").padEnd(typeWidth)}  ${(p.system ?? "").padEnd(systemWidth)}  ${p.path ?? "(no path)"}`
        );
      }
    } else {
      console.log(
        `${"NAME".padEnd(nameWidth)}  ${"TYPE".padEnd(typeWidth)}  PATH`
      );
      console.log(`${"─".repeat(nameWidth)}  ${"─".repeat(typeWidth)}  ${"─".repeat(40)}`);
      for (const p of projects) {
        console.log(
          `${p.name.padEnd(nameWidth)}  ${(p.type ?? "").padEnd(typeWidth)}  ${p.path ?? "(no path)"}`
        );
      }
    }
  });

// --- hop path <name> ---
program
  .command("path <name>")
  .description("Resolve the filesystem path for a project by name")
  .action((name) => {
    const { config } = loadOrExit();
    const projects = config.projects ?? [];
    const project = projects.find((p) => p.name === name);

    if (!project) {
      console.error(`Error: Project '${name}' not found.`);
      const names = projects.map((p) => p.name);
      if (names.length > 0) {
        console.error(`Available projects: ${names.join(", ")}`);
      }
      process.exit(1);
      return;
    }

    if (!project.path) {
      console.error(`Error: Project '${name}' has no path defined.`);
      process.exit(1);
      return;
    }

    // Output just the path (for use in scripts: cd $(hop path my-project))
    console.log(project.path);
  });

// --- hop machine ---
program
  .command("machine")
  .description("Show machine identity and configuration")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const { config, path: hopPath } = loadOrExit();
    const m = config.machine;

    if (opts.json) {
      console.log(JSON.stringify({ ...m, _hop_path: hopPath }, null, 2));
      return;
    }

    console.log(`Machine: ${m.name} (${m.id})`);
    if (m.type) console.log(`Type:    ${m.type}`);
    if (m.os) console.log(`OS:      ${m.os}`);
    if (m.arch) console.log(`Arch:    ${m.arch}`);
    if (m.agent_root) console.log(`Root:    ${m.agent_root}`);
    console.log(`Config:  ${hopPath}`);
  });

// --- hop account [username] ---
program
  .command("account [username]")
  .description("Show GitHub account details (default account if no username given)")
  .option("--json", "Output as JSON")
  .action((username, opts) => {
    const { config } = loadOrExit();
    const accounts = config.accounts?.github ?? [];

    if (accounts.length === 0) {
      console.error("No GitHub accounts configured.");
      process.exit(1);
      return;
    }

    let account;
    if (username) {
      account = accounts.find((a) => a.username === username);
      if (!account) {
        console.error(`Error: Account '${username}' not found.`);
        console.error(`Available: ${accounts.map((a) => a.username).join(", ")}`);
        process.exit(1);
        return;
      }
    } else {
      account = accounts.find((a) => a.default) ?? accounts[0];
    }

    if (opts.json) {
      console.log(JSON.stringify(account, null, 2));
      return;
    }

    console.log(`Username: ${account.username}`);
    if (account.role) console.log(`Role:     ${account.role}`);
    console.log(`Auth:     ${account.auth_method ?? "ssh"}`);
    console.log(`Default:  ${account.default ? "yes" : "no"}`);
    if (account.active === false) console.log(`Active:   no`);
    if (account.note) console.log(`Note:     ${account.note}`);
  });

// --- hop where ---
program
  .command("where")
  .description("Show the path to the discovered hop.json")
  .action(() => {
    const hopPath = discoverHopPath();
    if (!hopPath) {
      console.error("No hop.json found.");
      process.exit(1);
    }
    console.log(hopPath);
  });

// --- hop config ---
const configCmd = program
  .command("config")
  .description("Manage HarnessOps CLI configuration");

configCmd
  .command("set-path <path>")
  .description("Pin the hop.json location (writes to ~/.hop/settings.json)")
  .action((path) => {
    try {
      const resolved = setConfigPath(path);
      console.log(`✓ Pinned hop.json → ${resolved}`);
      console.log(`  Saved to ~/.hop/settings.json`);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

configCmd
  .command("show")
  .description("Show current configuration and discovery path")
  .action(() => {
    const hopPath = discoverHopPath();
    console.log(`Discovered hop.json: ${hopPath ?? "(not found)"}`);

    // Check if pinned via settings.json (authoritative) or legacy config.json
    const { existsSync, readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const { homedir } = require("node:os");
    const settingsFile = join(homedir(), ".hop", "settings.json");
    const legacyFile = join(homedir(), ".hop", "config.json");

    if (existsSync(settingsFile)) {
      try {
        const cfg = JSON.parse(readFileSync(settingsFile, "utf-8"));
        console.log(`Pinned path:        ${cfg.hop_config}`);
        console.log(`Source:             ~/.hop/settings.json`);
      } catch {
        console.log(`Pinned path:        (error reading ~/.hop/settings.json)`);
      }
    } else if (existsSync(legacyFile)) {
      try {
        const cfg = JSON.parse(readFileSync(legacyFile, "utf-8"));
        console.log(`Pinned path:        ${cfg.hop_config_path}`);
        console.log(`Source:             ~/.hop/config.json (legacy)`);
      } catch {
        console.log(`Pinned path:        (error reading ~/.hop/config.json)`);
      }
    } else {
      console.log(`Pinned path:        (not set — using discovery)`);
    }
  });

// --- hop bundles ---
program
  .command("bundles")
  .description("List all bundles defined in hop.json")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const { config } = loadOrExit();
    const bundles = config.bundles ?? [];

    if (opts.json) {
      console.log(JSON.stringify(bundles, null, 2));
      return;
    }

    if (bundles.length === 0) {
      console.log("No bundles defined.");
      return;
    }

    const idWidth = Math.max(2, ...bundles.map((b) => b.id.length));
    const nameWidth = Math.max(4, ...bundles.map((b) => b.name.length));

    console.log(
      `${"ID".padEnd(idWidth)}  ${"NAME".padEnd(nameWidth)}  PROJECTS`
    );
    console.log(`${"─".repeat(idWidth)}  ${"─".repeat(nameWidth)}  ${"─".repeat(40)}`);
    for (const b of bundles) {
      console.log(
        `${b.id.padEnd(idWidth)}  ${b.name.padEnd(nameWidth)}  ${b.projects.join(", ")}`
      );
    }
  });

// --- hop bundle <id> ---
program
  .command("bundle <id>")
  .description("Show details for a specific bundle by ID")
  .option("--json", "Output as JSON")
  .action((id, opts) => {
    const { config } = loadOrExit();
    const bundles = config.bundles ?? [];
    const bundle = bundles.find((b) => b.id === id);

    if (!bundle) {
      console.error(`Error: Bundle '${id}' not found.`);
      const ids = bundles.map((b) => b.id);
      if (ids.length > 0) {
        console.error(`Available bundles: ${ids.join(", ")}`);
      }
      process.exit(1);
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(bundle, null, 2));
      return;
    }

    console.log(`Bundle: ${bundle.name} (${bundle.id})`);
    if (bundle.description) console.log(`Description: ${bundle.description}`);
    console.log(`Projects: ${bundle.projects.join(", ")}`);
    if (bundle.primary_project) console.log(`Primary: ${bundle.primary_project}`);

    // Show project details if available
    const projects = config.projects ?? [];
    const matched = bundle.projects
      .map((name) => projects.find((p) => p.name === name))
      .filter(Boolean);
    if (matched.length > 0) {
      console.log("");
      const nameWidth = Math.max(4, ...matched.map((p) => p!.name.length));
      const typeWidth = Math.max(4, ...matched.map((p) => (p!.type ?? "").length));
      console.log(
        `${"NAME".padEnd(nameWidth)}  ${"TYPE".padEnd(typeWidth)}  PATH`
      );
      console.log(`${"─".repeat(nameWidth)}  ${"─".repeat(typeWidth)}  ${"─".repeat(40)}`);
      for (const p of matched) {
        console.log(
          `${p!.name.padEnd(nameWidth)}  ${(p!.type ?? "").padEnd(typeWidth)}  ${p!.path ?? "(no path)"}`
        );
      }
    }
  });

// --- hop infra ---
program
  .command("infra")
  .description("List infrastructure repository clones defined in hop.json")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const { config } = loadOrExit();
    const infra = config.infra_repos;

    if (!infra) {
      if (opts.json) {
        console.log(JSON.stringify({ path: null, repos: [] }, null, 2));
      } else {
        console.log("No infra_repos configured.");
      }
      return;
    }

    if (opts.json) {
      const repos = infra.repos ?? [];
      const basePath = infra.path;
      const repoStatus = basePath
        ? repos.map((entry) => {
            const name = infraRepoName(entry);
            const normalized = normalizeInfraRepo(entry);
            const repoPath = join(basePath, name);
            const isGit = existsSync(join(repoPath, ".git"));
            const exists = existsSync(repoPath);
            return {
              name,
              path: repoPath,
              status: isGit ? "cloned" : exists ? "present" : "missing",
              ...(normalized.system ? { system: normalized.system } : {}),
              ...(normalized.description ? { description: normalized.description } : {}),
              ...(normalized.upstream ? { upstream: normalized.upstream } : {}),
            };
          })
        : repos.map((entry) => {
            const normalized = normalizeInfraRepo(entry);
            return {
              name: normalized.name,
              path: null,
              status: "unknown",
              ...(normalized.system ? { system: normalized.system } : {}),
              ...(normalized.description ? { description: normalized.description } : {}),
              ...(normalized.upstream ? { upstream: normalized.upstream } : {}),
            };
          });
      console.log(JSON.stringify({ ...infra, repo_status: repoStatus }, null, 2));
      return;
    }

    console.log(`Path:     ${infra.path ?? "(not set)"}`);
    console.log(`Readonly: ${infra.readonly !== false ? "yes" : "no"}`);
    if (infra.sync) console.log(`Sync:     ${infra.sync}`);
    if (infra.contribute) {
      console.log(`Contribute: ${infra.contribute.allowed ? "allowed" : "not allowed"}`);
      if (infra.contribute.requires_flags?.length) {
        console.log(`  Requires: ${infra.contribute.requires_flags.join(", ")}`);
      }
    }

    const repos = infra.repos ?? [];
    if (repos.length === 0) {
      console.log("\nNo repos listed.");
      return;
    }

    console.log(`\nRepos (${repos.length}):`);
    const basePath = infra.path;
    for (const entry of repos) {
      const name = infraRepoName(entry);
      const normalized = normalizeInfraRepo(entry);
      const systemTag = normalized.system ? ` [system: ${normalized.system}]` : "";
      if (basePath) {
        const repoPath = join(basePath, name);
        const isGit = existsSync(join(repoPath, ".git"));
        const exists = existsSync(repoPath);
        const status = isGit ? "cloned" : exists ? "present (no .git)" : "missing";
        console.log(`  ${name}  [${status}]${systemTag}`);
      } else {
        console.log(`  ${name}${systemTag}`);
      }
    }
  });

// --- hop system list ---
const systemCmd = program
  .command("system")
  .description("Manage system groupings across projects and infra repos");

systemCmd
  .command("list")
  .description("List all unique systems with project and infra repo counts")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const { config } = loadOrExit();
    const systems = collectSystems(config);

    if (opts.json) {
      const result = Array.from(systems.entries()).map(([name, data]) => ({
        system: name,
        project_count: data.projects.length,
        infra_repo_count: data.infraRepos.length,
        projects: data.projects.map((p) => p.name),
        infra_repos: data.infraRepos.map((r) => r.name),
      }));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (systems.size === 0) {
      console.log("No systems defined. Add system fields to projects or infra repos.");
      return;
    }

    const entries = Array.from(systems.entries());
    const nameWidth = Math.max(6, ...entries.map(([name]) => name.length));

    console.log(
      `${"SYSTEM".padEnd(nameWidth)}  PROJECTS  INFRA`
    );
    console.log(`${"─".repeat(nameWidth)}  ${"─".repeat(8)}  ${"─".repeat(5)}`);
    for (const [name, data] of entries) {
      console.log(
        `${name.padEnd(nameWidth)}  ${String(data.projects.length).padEnd(8)}  ${data.infraRepos.length}`
      );
    }
  });

systemCmd
  .command("show <name>")
  .description("Show all projects and infra repos in a system")
  .option("--json", "Output as JSON")
  .action((name, opts) => {
    const { config } = loadOrExit();
    const systems = collectSystems(config);
    const system = systems.get(name);

    if (!system) {
      console.error(`Error: System '${name}' not found.`);
      const available = Array.from(systems.keys());
      if (available.length > 0) {
        console.error(`Available systems: ${available.join(", ")}`);
      } else {
        console.error("No systems defined. Add system fields to projects or infra repos.");
      }
      process.exit(1);
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify({
        system: name,
        projects: system.projects,
        infra_repos: system.infraRepos,
      }, null, 2));
      return;
    }

    console.log(`System: ${name}`);
    console.log("");

    if (system.projects.length > 0) {
      console.log(`Projects (${system.projects.length}):`);
      for (const p of system.projects) {
        console.log(`  ${p.name}  ${p.type ?? ""}  ${p.path ?? "(no path)"}`);
      }
    } else {
      console.log("Projects: (none)");
    }

    console.log("");

    if (system.infraRepos.length > 0) {
      console.log(`Infra Repos (${system.infraRepos.length}):`);
      for (const r of system.infraRepos) {
        const desc = r.description ? `  ${r.description}` : "";
        console.log(`  ${r.name}${desc}`);
      }
    } else {
      console.log("Infra Repos: (none)");
    }
  });

// --- hop validate ---
program
  .command("validate [file]")
  .description("Validate a hop.json file against the HarnessOps JSON Schema")
  .option("--schema <path>", "Path to custom schema file (default: bundled schema)")
  .action(async (file, opts) => {
    await runValidate({ file, schemaPath: opts.schema });
  });

// --- hop discover ---
program
  .command("discover [dir]")
  .description("Auto-scan a directory for projects, git repos, and tools")
  .option("--json", "Output as hop.json-compatible project entries")
  .option("-d, --depth <n>", "Max directory depth to scan (default: 3)", parseInt)
  .action(async (dir, opts) => {
    await runDiscover({ dir, depth: opts.depth, json: opts.json });
  });

// --- hop init ---
program
  .command("init")
  .description("Create a new hop.json interactively")
  .option("-o, --output <path>", "Output file path (default: ./hop.json)")
  .option("-y, --yes", "Accept defaults without prompting")
  .action(async (opts) => {
    await runInit({ output: opts.output, yes: opts.yes });
  });

program.parse();
