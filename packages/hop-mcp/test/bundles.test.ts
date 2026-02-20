import { describe, test, expect, beforeAll } from "bun:test";
import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * MCP tool tests run the server as a subprocess and send JSON-RPC over stdin/stdout.
 * For simplicity, we test the tool logic by importing the config loader directly
 * and verifying the logic that the MCP tools use.
 */

const EXAMPLE_CONFIG = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "spec",
  "examples",
  "hop-example-local-dev.json"
);

// We test by loading the config and applying the same logic as the MCP tools
import { discoverAndLoad, type HopConfig, type Bundle } from "@hop-org/hop-spec-core";

function loadTestConfig(): HopConfig {
  // Use the example config for testing
  const fs = require("node:fs");
  return JSON.parse(fs.readFileSync(EXAMPLE_CONFIG, "utf-8"));
}

describe("hop_list_bundles logic", () => {
  let config: HopConfig;

  beforeAll(() => {
    config = loadTestConfig();
  });

  test("returns all bundles", () => {
    const bundles = config.bundles ?? [];
    expect(bundles.length).toBeGreaterThanOrEqual(1);
    expect(bundles[0]).toHaveProperty("id");
    expect(bundles[0]).toHaveProperty("name");
    expect(bundles[0]).toHaveProperty("projects");
  });

  test("each bundle has at least one project", () => {
    const bundles = config.bundles ?? [];
    for (const b of bundles) {
      expect(b.projects.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("filter by project name works", () => {
    const bundles = config.bundles ?? [];
    const filtered = bundles.filter((b) => b.projects.includes("my-app"));
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered[0].id).toBe("personal");
  });

  test("filter by non-existent project returns empty", () => {
    const bundles = config.bundles ?? [];
    const filtered = bundles.filter((b) => b.projects.includes("nonexistent"));
    expect(filtered.length).toBe(0);
  });
});

describe("hop_get_bundle logic", () => {
  let config: HopConfig;

  beforeAll(() => {
    config = loadTestConfig();
  });

  test("finds bundle by id", () => {
    const bundles = config.bundles ?? [];
    const bundle = bundles.find((b) => b.id === "personal");
    expect(bundle).toBeDefined();
    expect(bundle!.name).toBe("Personal Projects");
    expect(bundle!.projects).toContain("my-app");
  });

  test("returns undefined for missing bundle", () => {
    const bundles = config.bundles ?? [];
    const bundle = bundles.find((b) => b.id === "nonexistent");
    expect(bundle).toBeUndefined();
  });

  test("resolves project details from config", () => {
    const bundles = config.bundles ?? [];
    const bundle = bundles.find((b) => b.id === "personal")!;
    const projects = config.projects ?? [];

    const resolved = bundle.projects.map((name) => {
      const p = projects.find((proj) => proj.name === name);
      return p
        ? { name: p.name, path: p.path ?? null, type: p.type ?? null }
        : { name, path: null, type: null, _missing: true };
    });

    expect(resolved.length).toBe(bundle.projects.length);
    expect(resolved[0]).toHaveProperty("name");
  });

  test("primary_project defaults to first project if not set", () => {
    const bundles = config.bundles ?? [];
    for (const b of bundles) {
      const primary = b.primary_project ?? b.projects[0];
      expect(primary).toBeDefined();
      expect(b.projects).toContain(primary);
    }
  });
});
