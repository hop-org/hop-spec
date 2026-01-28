/**
 * Tests for system-related MCP tools.
 * Uses the MCP Client SDK to test hop_list_systems and hop_get_system,
 * and verifies system field in hop_list_projects output.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const SYSTEM_FIXTURE = join(import.meta.dir, "..", "..", "hop-cli", "test", "fixtures", "system-test.json");
const NO_SYSTEMS_FIXTURE = join(import.meta.dir, "..", "..", "hop-cli", "test", "fixtures", "no-systems.json");
const SERVER_PATH = join(import.meta.dir, "..", "src", "index.ts");
const TEST_HOME = mkdtempSync(join(tmpdir(), "hop-mcp-system-test-"));

let client: Client;

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: "bun",
    args: [SERVER_PATH],
    env: {
      ...process.env,
      HOME: TEST_HOME,
      HOP_CONFIG_PATH: SYSTEM_FIXTURE,
    },
  });
  client = new Client({ name: "test-system-client", version: "0.1.0" });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
});

describe("hop_list_systems", () => {
  it("returns all systems with counts", async () => {
    const result = await client.callTool({ name: "hop_list_systems", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(3); // payments, analytics, ops

    const payments = parsed.systems.find((s: any) => s.system === "payments");
    expect(payments).toBeDefined();
    expect(payments.project_count).toBe(2);
    expect(payments.infra_repo_count).toBe(1);
    expect(payments.projects.map((p: any) => p.name)).toEqual(["api-core", "api-gateway"]);
    expect(payments.infra_repos[0].name).toBe("payment-sdk");
  });

  it("includes system with only infra repos", async () => {
    const result = await client.callTool({ name: "hop_list_systems", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);

    const ops = parsed.systems.find((s: any) => s.system === "ops");
    expect(ops).toBeDefined();
    expect(ops.project_count).toBe(0);
    expect(ops.infra_repo_count).toBe(1);
  });

  it("returns empty when no systems defined", async () => {
    // Use a separate client with minimal fixture
    const minTransport = new StdioClientTransport({
      command: "bun",
      args: [SERVER_PATH],
      env: {
        ...process.env,
        HOME: TEST_HOME,
        HOP_CONFIG_PATH: NO_SYSTEMS_FIXTURE,
      },
    });
    const minClient = new Client({ name: "test-minimal-system", version: "0.1.0" });
    await minClient.connect(minTransport);

    const result = await minClient.callTool({ name: "hop_list_systems", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(0);
    expect(parsed.systems).toEqual([]);

    await minClient.close();
  });
});

describe("hop_get_system", () => {
  it("returns system details", async () => {
    const result = await client.callTool({
      name: "hop_get_system",
      arguments: { name: "payments" },
    });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.system).toBe("payments");
    expect(parsed.project_count).toBe(2);
    expect(parsed.infra_repo_count).toBe(1);
    expect(parsed.projects[0].name).toBe("api-core");
    expect(parsed.infra_repos[0].name).toBe("payment-sdk");
    expect(parsed.infra_repos[0].upstream).toBe("https://github.com/example/payment-sdk.git");
  });

  it("returns error for unknown system", async () => {
    const result = await client.callTool({
      name: "hop_get_system",
      arguments: { name: "nonexistent" },
    });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.error).toContain("nonexistent");
    expect(parsed.available_systems).toContain("payments");
  });
});

describe("hop_list_projects includes system", () => {
  it("includes system field in project output", async () => {
    const result = await client.callTool({ name: "hop_list_projects", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);

    const apiCore = parsed.projects.find((p: any) => p.name === "api-core");
    expect(apiCore.system).toBe("payments");

    const standalone = parsed.projects.find((p: any) => p.name === "standalone");
    expect(standalone.system).toBeNull();
  });
});

describe("hop_list_infra_repos normalizes entries", () => {
  it("returns normalized objects for mixed string/object repos", async () => {
    const result = await client.callTool({ name: "hop_list_infra_repos", arguments: {} });
    const parsed = JSON.parse((result.content as any)[0].text);
    expect(parsed.count).toBe(4);

    // All entries should be objects now
    const paymentSdk = parsed.repos.find((r: any) => r.name === "payment-sdk");
    expect(paymentSdk.system).toBe("payments");
    expect(paymentSdk.description).toBe("Third-party payment SDK");

    const generic = parsed.repos.find((r: any) => r.name === "generic-tool");
    expect(generic).toBeDefined();
    expect(generic.name).toBe("generic-tool");
  });
});
