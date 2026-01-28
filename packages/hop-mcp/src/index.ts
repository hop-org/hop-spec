#!/usr/bin/env node

/**
 * HarnessOps MCP Server
 *
 * Exposes hop.json data to AI agents via Model Context Protocol.
 *
 * Tools:
 *   - hop_machine       — Get machine identity and configuration
 *   - hop_list_projects — List all projects (names, paths, types)
 *   - hop_get_project   — Get full project details by name
 *   - hop_get_account   — Get account info by service and optional username
 *   - hop_list_bundles  — List all bundles (project groupings)
 *   - hop_get_bundle    — Get bundle details with resolved project objects
 *   - hop_list_infra_repos — List infrastructure repo clones
 *   - hop_list_systems    — List all unique systems with their projects and infra repos
 *   - hop_get_system      — Get projects + infra repos for a specific system
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { discoverAndLoad, collectSystems, normalizeInfraRepo, infraRepoName, type HopConfig, type Project, type InfraRepoEntry } from "@harnessops/core";

function loadConfig(): { config: HopConfig; path: string } {
  const result = discoverAndLoad();
  if (!result) {
    throw new Error(
      "hop.json not found. Set HOP_CONFIG_PATH or place hop.json in a parent directory."
    );
  }
  return result;
}

// ---------- MCP Server ----------

const server = new McpServer(
  {
    name: "harnessops",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// --- hop_machine ---
server.tool(
  "hop_machine",
  "Get machine identity and configuration from hop.json. Returns machine id, name, type, OS, architecture, and agent_root.",
  {},
  async () => {
    const { config, path } = loadConfig();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              config_path: path,
              schema_version: config.schema_version,
              machine: config.machine,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- hop_list_projects ---
server.tool(
  "hop_list_projects",
  "List all projects registered in hop.json. Returns name, path, and type for each project.",
  {
    type: z
      .string()
      .optional()
      .describe("Filter projects by type (e.g., 'tool', 'website', 'dev-env')"),
  },
  async ({ type }) => {
    const { config } = loadConfig();
    let projects = config.projects ?? [];

    if (type) {
      projects = projects.filter((p) => p.type === type);
    }

    const summary = projects.map((p) => ({
      name: p.name,
      path: p.path ?? null,
      type: p.type ?? null,
      system: p.system ?? null,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: summary.length, projects: summary }, null, 2),
        },
      ],
    };
  }
);

// --- hop_get_project ---
server.tool(
  "hop_get_project",
  "Get full details for a specific project by name. Returns all fields including git config, extensions, and integrations.",
  {
    name: z.string().describe("Project name (slug) to look up"),
  },
  async ({ name }) => {
    const { config } = loadConfig();
    const project = (config.projects ?? []).find((p) => p.name === name);

    if (!project) {
      const available = (config.projects ?? []).map((p) => p.name);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Project '${name}' not found`,
                available_projects: available,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(project, null, 2),
        },
      ],
    };
  }
);

// --- hop_get_account ---
server.tool(
  "hop_get_account",
  "Get account information by service (e.g., 'github'). Optionally filter by username. Returns all matching accounts.",
  {
    service: z
      .string()
      .describe("Service name (e.g., 'github')"),
    username: z
      .string()
      .optional()
      .describe("Optional username to filter by"),
  },
  async ({ service, username }) => {
    const { config } = loadConfig();
    const accounts = config.accounts;

    if (!accounts) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No accounts configured in hop.json" }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const serviceAccounts = accounts[service];
    if (!serviceAccounts || !Array.isArray(serviceAccounts)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `No accounts found for service '${service}'`,
                available_services: Object.keys(accounts),
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    let results = serviceAccounts;
    if (username) {
      results = serviceAccounts.filter(
        (a: any) => a.username === username
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { service, count: results.length, accounts: results },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- hop_list_bundles ---
server.tool(
  "hop_list_bundles",
  "List all bundles defined in hop.json. Bundles are logical groupings of projects for workflow organization. Optionally filter to only bundles containing a specific project.",
  {
    project: z
      .string()
      .optional()
      .describe("Filter to bundles containing this project name"),
  },
  async ({ project }) => {
    const { config } = loadConfig();
    let bundles = config.bundles ?? [];

    if (project) {
      bundles = bundles.filter((b) => b.projects.includes(project));
    }

    const summary = bundles.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description ?? null,
      projects: b.projects,
      primary_project: b.primary_project ?? b.projects[0] ?? null,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: summary.length, bundles: summary }, null, 2),
        },
      ],
    };
  }
);

// --- hop_get_bundle ---
server.tool(
  "hop_get_bundle",
  "Get full details for a specific bundle by ID, including resolved project details for each member project.",
  {
    id: z.string().describe("Bundle ID (slug) to look up"),
  },
  async ({ id }) => {
    const { config } = loadConfig();
    const bundles = config.bundles ?? [];
    const bundle = bundles.find((b) => b.id === id);

    if (!bundle) {
      const available = bundles.map((b) => b.id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Bundle '${id}' not found`,
                available_bundles: available,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const projects = config.projects ?? [];
    const resolved = bundle.projects.map((name) => {
      const p = projects.find((proj) => proj.name === name);
      return p
        ? { name: p.name, path: p.path ?? null, type: p.type ?? null }
        : { name, path: null, type: null, _missing: true };
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...bundle,
              primary_project: bundle.primary_project ?? bundle.projects[0] ?? null,
              resolved_projects: resolved,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- hop_list_infra_repos ---
server.tool(
  "hop_list_infra_repos",
  "List infrastructure repository clones defined in hop.json. Infra repos are read-only reference clones of external repositories used for source inspection, API reference, or building from source.",
  {},
  async () => {
    const { config } = loadConfig();
    const infra = config.infra_repos;

    if (!infra) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { path: null, readonly: true, repos: [], count: 0 },
              null,
              2
            ),
          },
        ],
      };
    }

    const repos = (infra.repos ?? []).map((entry) => normalizeInfraRepo(entry));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              path: infra.path ?? null,
              readonly: infra.readonly !== false,
              sync: infra.sync ?? null,
              contribute: infra.contribute ?? null,
              repos: repos,
              count: repos.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- hop_list_systems ---
server.tool(
  "hop_list_systems",
  "List all unique systems defined across projects and infra repos. A system groups multiple repos that cooperate to deliver one capability (inspired by Backstage's System Model).",
  {},
  async () => {
    const { config } = loadConfig();
    const systems = collectSystems(config);

    const result: Array<{
      system: string;
      project_count: number;
      infra_repo_count: number;
      projects: Array<{ name: string; path: string | null; type: string | null }>;
      infra_repos: Array<{ name: string; description: string | null; upstream: string | null }>;
    }> = [];
    for (const [sysName, data] of systems as Map<string, { projects: Project[]; infraRepos: InfraRepoEntry[] }>) {
      result.push({
        system: sysName,
        project_count: data.projects.length,
        infra_repo_count: data.infraRepos.length,
        projects: data.projects.map((p) => ({
          name: p.name,
          path: p.path ?? null,
          type: p.type ?? null,
        })),
        infra_repos: data.infraRepos.map((r) => ({
          name: r.name,
          description: r.description ?? null,
          upstream: r.upstream ?? null,
        })),
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: result.length, systems: result }, null, 2),
        },
      ],
    };
  }
);

// --- hop_get_system ---
server.tool(
  "hop_get_system",
  "Get all projects and infra repos belonging to a specific system. Returns full project details and infra repo metadata for the named system.",
  {
    name: z.string().describe("System identifier (lowercase slug) to look up"),
  },
  async ({ name }) => {
    const { config } = loadConfig();
    const systems = collectSystems(config);
    const system = systems.get(name);

    if (!system) {
      const available = Array.from(systems.keys());
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `System '${name}' not found`,
                available_systems: available,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              system: name,
              project_count: system.projects.length,
              infra_repo_count: system.infraRepos.length,
              projects: system.projects,
              infra_repos: system.infraRepos,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------- Start ----------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("HarnessOps MCP server failed to start:", err);
  process.exit(1);
});
