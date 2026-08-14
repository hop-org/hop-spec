/**
 * Harness observation — read back what an agent harness currently has active.
 *
 * HarnessOps records *where* a harness keeps its configuration and nothing more.
 * This module does the reading: given those locations, it reports the MCP
 * servers, plugins, and skills actually in effect. Nothing here validates or
 * prescribes; a harness is free to hold whatever it holds.
 *
 * The distinction matters because these surfaces move quickly. Governing them
 * from a config spec would guarantee the spec is wrong within a release. Playing
 * them back costs little and answers the question people actually have, which is
 * "why isn't the thing I installed showing up".
 *
 * Every reader is responsible for declaring what it *cannot* see. A partial list
 * presented as complete is worse than no list at all.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { Harness } from "@hop-org/hop-spec-core";

export interface McpEntry {
  name: string;
  /** machine | project | unknown — where the server is declared. */
  scope: string;
  /** Which file it came from, so a reader can go look. */
  source: string;
}

export interface SkillDir {
  path: string;
  exists: boolean;
  count: number;
}

export interface HarnessObservation {
  name: string;
  type?: string;
  /** Whether the primary config was found — the harness looks present at all. */
  installed: boolean;
  /** Whether this reader understood the type well enough to parse it. */
  parsed: boolean;
  paths: { label: string; path: string; exists: boolean }[];
  mcpServers: McpEntry[];
  marketplaces: string[];
  plugins: string[];
  skills: SkillDir[];
  /** What this reader cannot see. Always rendered — never silently omitted. */
  disclosures: string[];
}

/** Count immediate subdirectories — the usual shape of a skills directory. */
function countSkillDirs(dir: string): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(
      (e) => e.isDirectory() && !e.name.startsWith(".")
    ).length;
  } catch {
    return 0;
  }
}

function readSkillDirs(paths: string[] | undefined): SkillDir[] {
  return (paths ?? []).map((p) => ({
    path: p,
    exists: existsSync(p),
    count: existsSync(p) ? countSkillDirs(p) : 0,
  }));
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Claude Code: JSON config, plugin cache directory, optional skills dirs.
 *
 * MCP servers appear at two local scopes — top-level `mcpServers` (machine) and
 * `projects[<path>].mcpServers` (project). A third scope exists that this cannot
 * reach: servers provisioned against the user's account are held server-side and
 * never written to disk, so they are disclosed rather than counted.
 */
function readClaudeCode(h: Harness, obs: HarnessObservation): void {
  obs.parsed = true;

  if (h.config && existsSync(h.config)) {
    const cfg = readJson(h.config);
    if (cfg) {
      for (const name of Object.keys((cfg.mcpServers as object) ?? {})) {
        obs.mcpServers.push({ name, scope: "machine", source: h.config });
      }
      const projects = (cfg.projects as Record<string, any>) ?? {};
      for (const [projPath, pv] of Object.entries(projects)) {
        for (const name of Object.keys(pv?.mcpServers ?? {})) {
          obs.mcpServers.push({
            name,
            scope: `project: ${basename(projPath) || projPath}`,
            source: h.config,
          });
        }
      }
    }
  }

  // Settings may enable plugins declaratively, which is how a marketplace is
  // activated without clicking through the plugin UI.
  if (h.settings && existsSync(h.settings)) {
    const s = readJson(h.settings);
    if (s) {
      for (const k of Object.keys((s.extraKnownMarketplaces as object) ?? {})) {
        if (!obs.marketplaces.includes(k)) obs.marketplaces.push(k);
      }
      for (const [k, v] of Object.entries((s.enabledPlugins as object) ?? {})) {
        if (v !== false) obs.plugins.push(k);
      }
    }
  }

  if (h.plugins && existsSync(h.plugins)) {
    const known = join(h.plugins, "known_marketplaces.json");
    if (existsSync(known)) {
      const k = readJson(known);
      for (const name of Object.keys(k ?? {})) {
        if (!obs.marketplaces.includes(name)) obs.marketplaces.push(name);
      }
    }
    // Installed plugins are cached at install time; no cache means nothing is
    // actually installed regardless of what marketplaces are known.
    const cache = join(h.plugins, "cache");
    if (existsSync(cache)) {
      try {
        for (const e of readdirSync(cache, { withFileTypes: true })) {
          if (e.isDirectory() && !obs.plugins.includes(e.name)) obs.plugins.push(e.name);
        }
      } catch {
        /* unreadable cache is not an error worth failing the report over */
      }
    }
  }

  obs.disclosures.push(
    "MCP servers provisioned against your Claude account (claude.ai connectors) are held server-side and never written to local config. They cannot be seen from this machine, so the list above is local servers only and is not the full set available in a session."
  );
  if (obs.marketplaces.length > 0 && obs.plugins.length === 0) {
    obs.disclosures.push(
      "A known marketplace is not the same as an installed plugin. Marketplaces are listed above but no plugin cache was found, so none of their skills or commands are active."
    );
  }
}

/**
 * Codex: TOML config, and skills commonly shared with other harnesses.
 *
 * Parsed with a shallow scan for `[mcp_servers.<name>]` table headers rather
 * than a full TOML parse — enough to name what is configured without adding a
 * dependency, and it degrades to finding nothing rather than to being wrong.
 */
function readCodex(h: Harness, obs: HarnessObservation): void {
  obs.parsed = true;

  if (h.config && existsSync(h.config)) {
    try {
      const raw = readFileSync(h.config, "utf-8");
      const re = /^\s*\[mcp_servers\.([^\]\s.]+)\]/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        obs.mcpServers.push({ name: m[1], scope: "machine", source: h.config });
      }
    } catch {
      /* unreadable config is reported as absent rather than crashing */
    }
  }

  obs.disclosures.push(
    "Codex MCP servers are read with a shallow scan of [mcp_servers.*] headers rather than a full TOML parse, so an unusual layout may be under-reported."
  );
  const shared = obs.skills.filter((s) => s.path.includes(".agents"));
  if (shared.length > 0) {
    obs.disclosures.push(
      "Skills under ~/.agents are shared with other harnesses (Gemini CLI reads the same directory), so a skill counted here may be active in more than one place."
    );
  }
}

/** Observe one declared harness. */
export function observeHarness(h: Harness): HarnessObservation {
  const obs: HarnessObservation = {
    name: h.name,
    type: h.type,
    installed: false,
    parsed: false,
    paths: [],
    mcpServers: [],
    marketplaces: [],
    plugins: [],
    skills: readSkillDirs(h.skills),
    disclosures: [],
  };

  for (const [label, p] of [
    ["config", h.config],
    ["settings", h.settings],
    ["plugins", h.plugins],
  ] as [string, string | undefined][]) {
    if (p) obs.paths.push({ label, path: p, exists: existsSync(p) });
  }

  obs.installed = obs.paths.some((p) => p.label === "config" && p.exists);

  switch (h.type) {
    case "claude-code":
      readClaudeCode(h, obs);
      break;
    case "codex":
    case "gemini-cli":
      readCodex(h, obs);
      break;
    default:
      obs.disclosures.push(
        `No reader for harness type ${h.type ? `"${h.type}"` : "(unspecified)"}. Declared locations are listed above but were not parsed.`
      );
  }

  if (!obs.installed) {
    obs.disclosures.unshift(
      "Primary config not found at the declared path — this harness appears not to be installed on this machine."
    );
  }

  return obs;
}
