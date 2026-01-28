/**
 * Unit tests for hop-core helper utilities.
 * Tests normalizeInfraRepo, infraRepoName, collectSystems, and system field validation patterns.
 */

import { describe, it, expect } from "bun:test";
import { normalizeInfraRepo, infraRepoName, collectSystems } from "../src/helpers.js";
import type { HopConfig } from "../src/types.js";

describe("normalizeInfraRepo", () => {
  it("normalizes a string to an InfraRepoEntry", () => {
    const result = normalizeInfraRepo("my-repo");
    expect(result).toEqual({ name: "my-repo" });
  });

  it("passes through an object unchanged", () => {
    const entry = { name: "my-repo", system: "payments", description: "Test" };
    const result = normalizeInfraRepo(entry);
    expect(result).toEqual(entry);
  });

  it("handles object with all fields", () => {
    const entry = {
      name: "sdk",
      system: "payments",
      description: "SDK lib",
      upstream: "https://github.com/example/sdk.git",
    };
    const result = normalizeInfraRepo(entry);
    expect(result.name).toBe("sdk");
    expect(result.system).toBe("payments");
    expect(result.upstream).toBe("https://github.com/example/sdk.git");
  });

  it("handles object with only name", () => {
    const result = normalizeInfraRepo({ name: "bare" });
    expect(result).toEqual({ name: "bare" });
  });
});

describe("infraRepoName", () => {
  it("extracts name from string", () => {
    expect(infraRepoName("my-repo")).toBe("my-repo");
  });

  it("extracts name from object", () => {
    expect(infraRepoName({ name: "my-repo", system: "x" })).toBe("my-repo");
  });
});

describe("collectSystems", () => {
  const makeConfig = (overrides: Partial<HopConfig> = {}): HopConfig => ({
    schema_version: "0.1.0",
    machine: { id: "test", name: "Test" },
    ...overrides,
  });

  it("returns empty map when no systems defined", () => {
    const config = makeConfig({
      projects: [{ name: "a" }, { name: "b" }],
    });
    const systems = collectSystems(config);
    expect(systems.size).toBe(0);
  });

  it("collects systems from projects", () => {
    const config = makeConfig({
      projects: [
        { name: "api", system: "payments" },
        { name: "gateway", system: "payments" },
        { name: "dashboard", system: "analytics" },
        { name: "standalone" },
      ],
    });
    const systems = collectSystems(config);
    expect(systems.size).toBe(2);
    expect(systems.get("payments")!.projects).toHaveLength(2);
    expect(systems.get("analytics")!.projects).toHaveLength(1);
  });

  it("collects systems from infra repos (object entries)", () => {
    const config = makeConfig({
      infra_repos: {
        repos: [
          { name: "sdk", system: "payments" },
          { name: "charts", system: "analytics" },
          "plain-repo",
        ],
      },
    });
    const systems = collectSystems(config);
    expect(systems.size).toBe(2);
    expect(systems.get("payments")!.infraRepos).toHaveLength(1);
    expect(systems.get("payments")!.infraRepos[0].name).toBe("sdk");
    expect(systems.get("analytics")!.infraRepos).toHaveLength(1);
  });

  it("merges projects and infra repos under same system", () => {
    const config = makeConfig({
      projects: [
        { name: "api", system: "payments" },
      ],
      infra_repos: {
        repos: [
          { name: "sdk", system: "payments" },
        ],
      },
    });
    const systems = collectSystems(config);
    expect(systems.size).toBe(1);
    const payments = systems.get("payments")!;
    expect(payments.projects).toHaveLength(1);
    expect(payments.infraRepos).toHaveLength(1);
  });

  it("handles config with no projects or infra repos", () => {
    const config = makeConfig();
    const systems = collectSystems(config);
    expect(systems.size).toBe(0);
  });

  it("handles mixed string and object infra repos", () => {
    const config = makeConfig({
      infra_repos: {
        repos: [
          "string-repo",
          { name: "object-repo", system: "sys1" },
          "another-string",
          { name: "another-object" },
        ],
      },
    });
    const systems = collectSystems(config);
    // Only object-repo has system
    expect(systems.size).toBe(1);
    expect(systems.get("sys1")!.infraRepos).toHaveLength(1);
  });
});

describe("system field pattern validation", () => {
  // These test the pattern: ^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$
  const SYSTEM_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

  it("accepts lowercase slugs", () => {
    expect(SYSTEM_PATTERN.test("payments")).toBe(true);
    expect(SYSTEM_PATTERN.test("billing-ops")).toBe(true);
    expect(SYSTEM_PATTERN.test("agent-flywheel")).toBe(true);
    expect(SYSTEM_PATTERN.test("a")).toBe(true);
    expect(SYSTEM_PATTERN.test("a1")).toBe(true);
    expect(SYSTEM_PATTERN.test("123")).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(SYSTEM_PATTERN.test("")).toBe(false);
    expect(SYSTEM_PATTERN.test("UPPER")).toBe(false);
    expect(SYSTEM_PATTERN.test("has_underscore")).toBe(false);
    expect(SYSTEM_PATTERN.test("has space")).toBe(false);
    expect(SYSTEM_PATTERN.test("-leading-dash")).toBe(false);
    expect(SYSTEM_PATTERN.test("trailing-dash-")).toBe(false);
    expect(SYSTEM_PATTERN.test("double--dash")).toBe(true); // allowed by pattern
  });
});
