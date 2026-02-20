/**
 * hop init — Interactive hop.json creation.
 *
 * Prompts the user for machine identity and optional project/account info,
 * then writes a minimal hop.json to the chosen location.
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir, hostname as getHostname } from "node:os";
import { createInterface } from "node:readline";
import type { HopConfig, Machine } from "@hop-org/hop-spec-core";
import { discoverHopPath, ensureHopDir, setConfigPath, HOP_DEFAULT_PATH } from "@hop-org/hop-spec-core";

const SCHEMA_URL = "https://harnessops.org/schema/v0.1.0/hop.json";
const SCHEMA_VERSION = "0.1.0";

interface PromptResult {
  config: HopConfig;
  outputPath: string;
}

/**
 * Simple readline-based prompt (no external dependency needed).
 */
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  function ask(question: string, defaultValue?: string): Promise<string> {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    return new Promise((resolve) => {
      rl.question(`${question}${suffix}: `, (answer) => {
        resolve(answer.trim() || defaultValue || "");
      });
    });
  }

  function confirm(question: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    return new Promise((resolve) => {
      rl.question(`${question} ${hint}: `, (answer) => {
        const a = answer.trim().toLowerCase();
        if (a === "") resolve(defaultYes);
        else resolve(a === "y" || a === "yes");
      });
    });
  }

  function close() {
    rl.close();
  }

  return { ask, confirm, close };
}

/**
 * Detect reasonable defaults from the environment.
 */
function detectDefaults() {
  const hostname = getHostname().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const cwd = process.cwd();
  const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : "x86";

  // Guess machine type
  let machineType: Machine["type"] = "local-laptop";
  if (process.env.CODESPACES) machineType = "cloud-vm";
  else if (process.env.GITPOD_WORKSPACE_ID) machineType = "cloud-vm";
  else if (existsSync("/.dockerenv")) machineType = "container";
  else if (process.env.WSL_DISTRO_NAME) machineType = "wsl";
  else if (process.env.SSH_CLIENT && os === "linux") machineType = "cloud-vps";

  return { hostname, cwd, os, arch, machineType };
}

/**
 * Slugify a string for use as machine.id or project.name.
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "my-machine";
}

export async function runInit(opts: { output?: string; yes?: boolean }): Promise<void> {
  const defaults = detectDefaults();
  const prompt = createPrompter();

  console.log("HarnessOps — Create a new hop.json\n");

  try {
    // --- Output path ---
    // Default: ~/.hop/hop.json (the canonical home for HarnessOps config)
    let outputPath: string;
    if (opts.output) {
      outputPath = resolve(opts.output);
    } else if (opts.yes) {
      ensureHopDir();
      outputPath = HOP_DEFAULT_PATH;
    } else {
      const answer = await prompt.ask("Output path", HOP_DEFAULT_PATH);
      outputPath = resolve(answer);
    }

    // Check for existing file at the target path
    if (existsSync(outputPath)) {
      if (opts.yes) {
        console.error(`Error: ${outputPath} already exists. Use a different path or remove it first.`);
        process.exit(1);
      }
      const overwrite = await prompt.confirm(`${outputPath} already exists. Overwrite?`, false);
      if (!overwrite) {
        console.log("Aborted.");
        process.exit(0);
      }
    }

    // Check for hop.json in parent directories (discovery walks up, so a
    // nested hop.json can shadow or be shadowed by a parent one)
    const outputDir = dirname(outputPath);
    const parentDir = dirname(outputDir);
    if (parentDir !== outputDir) {
      const existingPath = discoverHopPath(parentDir);
      if (existingPath) {
        if (opts.yes) {
          console.warn(`Warning: hop.json already exists at ${existingPath}`);
          console.warn(`  Creating a nested config may cause confusion with discovery.`);
        } else {
          console.warn(`\nWarning: hop.json found in parent directory: ${existingPath}`);
          console.warn(`  Discovery walks up from cwd, so the parent config may take precedence.`);
          const proceed = await prompt.confirm("Continue creating a nested hop.json?", false);
          if (!proceed) {
            console.log("Aborted.");
            process.exit(0);
          }
        }
      }
    }

    // --- Machine identity ---
    let machineId: string;
    let machineName: string;
    let machineType: Machine["type"] | undefined;
    let agentRoot: string | undefined;

    if (opts.yes) {
      machineId = defaults.hostname;
      machineName = defaults.hostname;
      machineType = defaults.machineType;
      agentRoot = homedir();
    } else {
      machineId = slugify(await prompt.ask("Machine ID (slug)", defaults.hostname));
      machineName = await prompt.ask("Machine name (human-readable)", defaults.hostname);

      const typeChoices = ["cloud-vps", "cloud-vm", "local-desktop", "local-laptop", "container", "wsl"];
      const defaultTypeIdx = typeChoices.indexOf(defaults.machineType ?? "local-laptop");
      console.log("\nMachine types:");
      typeChoices.forEach((t, i) => console.log(`  ${i + 1}. ${t}${i === defaultTypeIdx ? " (detected)" : ""}`));
      const typeAnswer = await prompt.ask("Machine type (number or name)", String(defaultTypeIdx + 1));
      const typeIdx = parseInt(typeAnswer, 10);
      if (typeIdx >= 1 && typeIdx <= typeChoices.length) {
        machineType = typeChoices[typeIdx - 1] as Machine["type"];
      } else if (typeChoices.includes(typeAnswer)) {
        machineType = typeAnswer as Machine["type"];
      } else {
        machineType = defaults.machineType;
      }

      agentRoot = await prompt.ask("Agent root directory", defaults.cwd) || undefined;
    }

    // Build machine object
    const machine: Machine = {
      id: machineId,
      name: machineName,
    };
    if (machineType) machine.type = machineType;
    machine.os = defaults.os as Machine["os"];
    machine.arch = defaults.arch as Machine["arch"];
    if (agentRoot) machine.agent_root = agentRoot;

    // --- Build config ---
    const config: HopConfig = {
      $schema: SCHEMA_URL,
      schema_version: SCHEMA_VERSION,
      machine,
    };

    // --- Optional: add a project ---
    let addProject = false;
    if (!opts.yes) {
      addProject = await prompt.confirm("\nAdd a project?", false);
    }

    if (addProject) {
      const projName = slugify(await prompt.ask("Project name (slug)", "my-project"));
      const projPath = await prompt.ask("Project path", join(agentRoot || defaults.cwd, projName));
      const projType = await prompt.ask("Project type (e.g. tool, website, research)", "tool");

      config.projects = [
        {
          name: projName,
          path: projPath,
          type: projType || undefined,
        },
      ];

      const addGit = await prompt.confirm("Add git remote?", false);
      if (addGit) {
        const remoteUrl = await prompt.ask("Git remote URL");
        const defaultBranch = await prompt.ask("Default branch", "main");
        config.projects[0].git = {
          remote_url: remoteUrl || undefined,
          default_branch: defaultBranch,
        };
      }
    }

    // --- Write file ---
    // Always ensure ~/.hop/ exists
    ensureHopDir();

    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const json = JSON.stringify(config, null, 2) + "\n";
    writeFileSync(outputPath, json, "utf-8");

    const resolvedOutput = resolve(outputPath);
    const isDefaultPath = resolvedOutput === resolve(HOP_DEFAULT_PATH);

    // Write settings.json pointing to the new hop.json (only for non-default paths)
    if (!isDefaultPath) {
      setConfigPath(resolvedOutput);
    }

    console.log(`\n✓ Created ${outputPath}`);
    console.log(`  Schema:   v${SCHEMA_VERSION}`);
    console.log(`  Machine:  ${machine.name} (${machine.id})`);
    if (!isDefaultPath) {
      console.log(`  Settings: ~/.hop/settings.json → ${resolvedOutput}`);
    }
    if (config.projects?.length) {
      console.log(`  Project:  ${config.projects[0].name}`);
    }
    console.log(`\nNext steps:`);
    console.log(`  • Edit ${outputPath} to add projects, accounts, and bundles`);
    console.log(`  • Run 'hop validate' to check your configuration`);
    console.log(`  • Run 'hop projects' to list registered projects`);
  } finally {
    prompt.close();
  }
}
