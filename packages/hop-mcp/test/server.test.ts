/**
 * Tests for HarnessOps MCP server.
 *
 * Uses the MCP Client SDK to connect to the server via stdio
 * and exercises all 6 tools against a known hop.json fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const FIXTURE_PATH = join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-vps-server.json");
const SERVER_PATH = join(import.meta.dir, "..", "src", "index.ts");

// Use a temp HOME so ~/.hop/settings.json doesn't interfere with discovery
const TEST_HOME = mkdtempSync(join(tmpdir(), "hop-mcp-test-"));

let client: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  transport = new StdioClientTransport({
    command: "bun",
    args: [SERVER_PATH],
    env: {
      ...process.env,
      HOME: TEST_HOME,
      HOP_CONFIG_PATH: FIXTURE_PATH,
    },
  });
  client = new Client({ name: "test-client", version: "0.1.0" });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
});

describe("hop_machine", () => {
  it("returns machine identity", async () => {
    const result = await client.callTool({ name: "hop_machine", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");

    const parsed = JSON.parse(content[0].text);
    expect(parsed.machine.id).toBe("prod-vps");
    expect(parsed.machine.name).toBe("Production VPS Server");
    expect(parsed.machine.type).toBe("cloud-vps");
    expect(parsed.machine.os).toBe("linux");
    expect(parsed.schema_version).toBe("0.1.0");
  });
});

describe("hop_list_projects", () => {
  it("lists all projects", async () => {
    const result = await client.callTool({ name: "hop_list_projects", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(3);
    expect(parsed.projects.map((p: any) => p.name)).toEqual([
      "api-prod",
      "web-prod",
      "infra-scripts",
    ]);
  });

  it("filters by type", async () => {
    const result = await client.callTool({
      name: "hop_list_projects",
      arguments: { type: "website" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(1);
    expect(parsed.projects[0].name).toBe("web-prod");
  });

  it("returns empty for unknown type", async () => {
    const result = await client.callTool({
      name: "hop_list_projects",
      arguments: { type: "nonexistent" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(0);
    expect(parsed.projects).toEqual([]);
  });
});

describe("hop_get_project", () => {
  it("returns project details", async () => {
    const result = await client.callTool({
      name: "hop_get_project",
      arguments: { name: "infra-scripts" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.name).toBe("infra-scripts");
    expect(parsed.path).toBe("/home/deploy/projects/infra");
    expect(parsed.type).toBe("dev-env");
    expect(parsed.git.default_branch).toBe("main");
    expect(parsed.extensions.beads.enabled).toBe(true);
    expect(parsed.extensions.beads.prefix).toBe("infra");
  });

  it("returns error for unknown project", async () => {
    const result = await client.callTool({
      name: "hop_get_project",
      arguments: { name: "does-not-exist" },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.error).toContain("does-not-exist");
    expect(parsed.available_projects).toContain("api-prod");
  });
});

describe("hop_get_account", () => {
  it("returns github accounts", async () => {
    const result = await client.callTool({
      name: "hop_get_account",
      arguments: { service: "github" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.service).toBe("github");
    expect(parsed.count).toBe(2);
    expect(parsed.accounts[0].username).toBe("deploy-bot");
  });

  it("filters by username", async () => {
    const result = await client.callTool({
      name: "hop_get_account",
      arguments: { service: "github", username: "admin-user" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(1);
    expect(parsed.accounts[0].username).toBe("admin-user");
    expect(parsed.accounts[0].auth_method).toBe("https-pat");
  });

  it("returns error for unknown service", async () => {
    const result = await client.callTool({
      name: "hop_get_account",
      arguments: { service: "gitlab" },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.error).toContain("gitlab");
  });
});

describe("hop_list_bundles", () => {
  it("lists all bundles", async () => {
    const result = await client.callTool({ name: "hop_list_bundles", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(2);
    expect(parsed.bundles.map((b: any) => b.id)).toEqual(["production", "ops"]);
  });

  it("filters by project membership", async () => {
    const result = await client.callTool({
      name: "hop_list_bundles",
      arguments: { project: "api-prod" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(1);
    expect(parsed.bundles[0].id).toBe("production");
  });

  it("returns empty for unmatched project filter", async () => {
    const result = await client.callTool({
      name: "hop_list_bundles",
      arguments: { project: "nonexistent" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(0);
    expect(parsed.bundles).toEqual([]);
  });
});

describe("hop_list_infra_repos", () => {
  it("returns infra repos configuration", async () => {
    const result = await client.callTool({ name: "hop_list_infra_repos", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.path).toBe("/home/deploy/infra-clones");
    expect(parsed.readonly).toBe(true);
    expect(parsed.sync).toBe("weekly-cron-pull");
    expect(parsed.count).toBe(3);
    // repos are now normalized to objects (mixed string/object support)
    const repoNames = parsed.repos.map((r: any) => r.name);
    expect(repoNames).toContain("docker-compose-templates");
    expect(repoNames).toContain("nginx-configs");
    expect(repoNames).toContain("monitoring-dashboards");
  });

  it("returns empty when no infra_repos configured", async () => {
    // Use a separate client with minimal fixture
    const minimalFixture = join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-minimal.json");
    const minTransport = new StdioClientTransport({
      command: "bun",
      args: [SERVER_PATH],
      env: {
        ...process.env,
        HOME: TEST_HOME,
        HOP_CONFIG_PATH: minimalFixture,
      },
    });
    const minClient = new Client({ name: "test-minimal", version: "0.1.0" });
    await minClient.connect(minTransport);

    const result = await minClient.callTool({ name: "hop_list_infra_repos", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.path).toBeNull();
    expect(parsed.repos).toEqual([]);
    expect(parsed.count).toBe(0);

    await minClient.close();
  });
});

describe("hop_get_bundle", () => {
  it("returns bundle details with resolved projects", async () => {
    const result = await client.callTool({
      name: "hop_get_bundle",
      arguments: { id: "production" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.id).toBe("production");
    expect(parsed.name).toBe("Production Services");
    expect(parsed.projects).toEqual(["api-prod", "web-prod"]);
    expect(parsed.primary_project).toBe("api-prod");
    expect(parsed.resolved_projects).toHaveLength(2);
    expect(parsed.resolved_projects[0].name).toBe("api-prod");
    expect(parsed.resolved_projects[0].path).toBe("/home/deploy/projects/api");
  });

  it("returns error for unknown bundle", async () => {
    const result = await client.callTool({
      name: "hop_get_bundle",
      arguments: { id: "nonexistent" },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.error).toContain("nonexistent");
    expect(parsed.available_bundles).toContain("production");
  });
});
