/**
 * Tests for system field integration in the hop CLI.
 * Tests system list, system show, project system filtering,
 * and mixed string/object infra repo handling.
 */

import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
const SYSTEM_FIXTURE = join(import.meta.dir, "fixtures", "system-test.json");
const NO_SYSTEMS = join(import.meta.dir, "fixtures", "no-systems.json");

const TEST_HOME = mkdtempSync(join(tmpdir(), "hop-system-test-"));

async function run(args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    env: { ...process.env, HOME: TEST_HOME, HOP_CONFIG_PATH: SYSTEM_FIXTURE, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// --- hop system list ---

describe("hop system list", () => {
  it("lists all systems with counts", async () => {
    const { stdout, exitCode } = await run(["system", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SYSTEM");
    expect(stdout).toContain("PROJECTS");
    expect(stdout).toContain("INFRA");
    expect(stdout).toContain("payments");
    expect(stdout).toContain("analytics");
    expect(stdout).toContain("ops");
  });

  it("outputs JSON with --json", async () => {
    const { stdout, exitCode } = await run(["system", "list", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);

    const payments = parsed.find((s: any) => s.system === "payments");
    expect(payments).toBeDefined();
    expect(payments.project_count).toBe(2);
    expect(payments.infra_repo_count).toBe(1);
    expect(payments.projects).toContain("api-core");
    expect(payments.projects).toContain("api-gateway");
    expect(payments.infra_repos).toContain("payment-sdk");

    const analytics = parsed.find((s: any) => s.system === "analytics");
    expect(analytics.project_count).toBe(1);
    expect(analytics.infra_repo_count).toBe(1);

    const ops = parsed.find((s: any) => s.system === "ops");
    expect(ops.project_count).toBe(0);
    expect(ops.infra_repo_count).toBe(1);
  });

  it("shows message when no systems defined", async () => {
    const { stdout, exitCode } = await run(["system", "list"], { HOP_CONFIG_PATH: NO_SYSTEMS });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("No systems defined");
  });
});

// --- hop system show ---

describe("hop system show", () => {
  it("shows projects and infra repos for a system", async () => {
    const { stdout, exitCode } = await run(["system", "show", "payments"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System: payments");
    expect(stdout).toContain("api-core");
    expect(stdout).toContain("api-gateway");
    expect(stdout).toContain("payment-sdk");
  });

  it("outputs JSON with --json", async () => {
    const { stdout, exitCode } = await run(["system", "show", "payments", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.system).toBe("payments");
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.infra_repos).toHaveLength(1);
    expect(parsed.infra_repos[0].name).toBe("payment-sdk");
  });

  it("errors for unknown system", async () => {
    const { stderr, exitCode } = await run(["system", "show", "nonexistent"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
    expect(stderr).toContain("Available systems");
  });

  it("shows system with only infra repos (no projects)", async () => {
    const { stdout, exitCode } = await run(["system", "show", "ops"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("System: ops");
    expect(stdout).toContain("(none)");
    expect(stdout).toContain("deploy-scripts");
  });
});

// --- hop projects with system ---

describe("hop projects with system field", () => {
  it("shows SYSTEM column when systems are present", async () => {
    const { stdout, exitCode } = await run(["projects"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SYSTEM");
    expect(stdout).toContain("payments");
    expect(stdout).toContain("analytics");
  });

  it("filters by --system", async () => {
    const { stdout, exitCode } = await run(["projects", "--system", "payments"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("api-core");
    expect(stdout).toContain("api-gateway");
    expect(stdout).not.toContain("dashboard");
    expect(stdout).not.toContain("standalone");
  });

  it("returns empty when filtering by unknown system", async () => {
    const { stdout, exitCode } = await run(["projects", "--system", "nonexistent"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("No projects found");
  });

  it("JSON output includes system field", async () => {
    const { stdout, exitCode } = await run(["projects", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const apiCore = parsed.find((p: any) => p.name === "api-core");
    expect(apiCore.system).toBe("payments");
    const standalone = parsed.find((p: any) => p.name === "standalone");
    expect(standalone.system).toBeUndefined();
  });
});

// --- hop infra with mixed entries ---

describe("hop infra with mixed string/object entries", () => {
  it("lists all repos including object entries", async () => {
    const { stdout, exitCode } = await run(["infra"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("payment-sdk");
    expect(stdout).toContain("chart-lib");
    expect(stdout).toContain("generic-tool");
    expect(stdout).toContain("deploy-scripts");
    // System tags shown for object entries
    expect(stdout).toContain("[system: payments]");
    expect(stdout).toContain("[system: analytics]");
    expect(stdout).toContain("[system: ops]");
  });

  it("JSON output normalizes all entries", async () => {
    const { stdout, exitCode } = await run(["infra", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.repo_status).toHaveLength(4);

    const paymentSdk = parsed.repo_status.find((r: any) => r.name === "payment-sdk");
    expect(paymentSdk.system).toBe("payments");
    expect(paymentSdk.description).toBe("Third-party payment SDK");
    expect(paymentSdk.upstream).toBe("https://github.com/example/payment-sdk.git");

    const generic = parsed.repo_status.find((r: any) => r.name === "generic-tool");
    expect(generic.system).toBeUndefined();
  });
});

// --- Validation: system field pattern ---

describe("system field validation", () => {
  it("validates system-test fixture against schema", async () => {
    const { stdout, exitCode } = await run(["validate", SYSTEM_FIXTURE]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });
});
