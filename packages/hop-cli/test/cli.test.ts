/**
 * Integration tests for the hop CLI.
 * Runs each subcommand via Bun.spawn against a known hop.json fixture.
 */

import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
const FIXTURE = join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-vps-server.json");
const MINIMAL = join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-minimal.json");

// Use a temp HOME so ~/.hop/settings.json doesn't interfere with discovery
const TEST_HOME = mkdtempSync(join(tmpdir(), "hop-cli-test-"));

async function run(args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    env: { ...process.env, HOME: TEST_HOME, HOP_CONFIG_PATH: FIXTURE, ...env },
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

describe("hop machine", () => {
  it("prints machine info", async () => {
    const { stdout, exitCode } = await run(["machine"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("prod-vps");
    expect(stdout).toContain("Production VPS Server");
    expect(stdout).toContain("cloud-vps");
  });

  it("outputs JSON with --json", async () => {
    const { stdout, exitCode } = await run(["machine", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.id).toBe("prod-vps");
    expect(parsed.os).toBe("linux");
  });
});

describe("hop projects", () => {
  it("lists all projects in table format", async () => {
    const { stdout, exitCode } = await run(["projects"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("api-prod");
    expect(stdout).toContain("web-prod");
    expect(stdout).toContain("infra-scripts");
  });

  it("filters by type", async () => {
    const { stdout, exitCode } = await run(["projects", "-t", "website"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("web-prod");
    expect(stdout).not.toContain("api-prod");
  });

  it("outputs JSON with --json", async () => {
    const { stdout, exitCode } = await run(["projects", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe("api-prod");
  });
});

describe("hop path", () => {
  it("resolves project path", async () => {
    const { stdout, exitCode } = await run(["path", "api-prod"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe("/home/deploy/projects/api");
  });

  it("exits 1 for unknown project", async () => {
    const { stderr, exitCode } = await run(["path", "nonexistent"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });
});

describe("hop account", () => {
  it("shows default account", async () => {
    const { stdout, exitCode } = await run(["account"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("deploy-bot");
    expect(stdout).toContain("primary");
  });

  it("shows specific account", async () => {
    const { stdout, exitCode } = await run(["account", "admin-user"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("admin-user");
    expect(stdout).toContain("https-pat");
  });

  it("exits 1 for unknown account", async () => {
    const { stderr, exitCode } = await run(["account", "nobody"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });
});

describe("hop where", () => {
  it("prints config path", async () => {
    const { stdout, exitCode } = await run(["where"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("hop-example-vps-server.json");
  });
});

describe("hop validate", () => {
  it("validates a valid file", async () => {
    const { stdout, exitCode } = await run(["validate", MINIMAL]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });

  it("validates vps-server example", async () => {
    const { stdout, exitCode } = await run(["validate", FIXTURE]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });

  it("reports errors for invalid content", async () => {
    const invalid = join(import.meta.dir, "fixtures", "invalid.json");
    const { stderr, exitCode } = await run(["validate", invalid]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid");
  });
});

describe("hop init", () => {
  const INIT_OUT = join(import.meta.dir, "fixtures", "init-output.json");

  it("creates hop.json with --yes flag", async () => {
    if (existsSync(INIT_OUT)) rmSync(INIT_OUT);
    const { stdout, exitCode } = await run(["init", "-y", "-o", INIT_OUT]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Created");
    expect(existsSync(INIT_OUT)).toBe(true);

    const content = JSON.parse(readFileSync(INIT_OUT, "utf-8"));
    expect(content.schema_version).toBe("0.1.0");
    expect(content.machine.id).toBeDefined();
    expect(content.machine.name).toBeDefined();
    expect(content.machine.os).toBeDefined();
    expect(content.machine.arch).toBeDefined();
    expect(content.$schema).toContain("harnessops.org");

    // Cleanup
    rmSync(INIT_OUT, { force: true });
  });

  it("refuses to overwrite existing file with --yes", async () => {
    writeFileSync(INIT_OUT, "{}");
    const { stderr, exitCode } = await run(["init", "-y", "-o", INIT_OUT]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
    rmSync(INIT_OUT, { force: true });
  });

  it("generated file validates against schema", async () => {
    if (existsSync(INIT_OUT)) rmSync(INIT_OUT);
    await run(["init", "-y", "-o", INIT_OUT]);
    const { stdout, exitCode } = await run(["validate", INIT_OUT]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
    rmSync(INIT_OUT, { force: true });
  });
});

describe("hop infra", () => {
  it("lists infra repos with sync status", async () => {
    const { stdout, exitCode } = await run(["infra"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Path:");
    expect(stdout).toContain("/home/deploy/infra-clones");
    expect(stdout).toContain("Readonly: yes");
    expect(stdout).toContain("Sync:     weekly-cron-pull");
    expect(stdout).toContain("docker-compose-templates");
    expect(stdout).toContain("[missing]");
  });

  it("outputs JSON with --json including repo_status", async () => {
    const { stdout, exitCode } = await run(["infra", "--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.path).toBe("/home/deploy/infra-clones");
    expect(parsed.readonly).toBe(true);
    // repos are now normalized to objects (mixed string/object support)
    expect(parsed.repos.map((r: any) => typeof r === "string" ? r : r.name)).toContain("nginx-configs");
    expect(parsed.repo_status).toHaveLength(3);
    expect(parsed.repo_status[0].name).toBe("docker-compose-templates");
    expect(parsed.repo_status[0].status).toBe("missing");
  });

  it("handles missing infra_repos gracefully", async () => {
    const { stdout, exitCode } = await run(["infra"], { HOP_CONFIG_PATH: MINIMAL });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("No infra_repos configured");
  });

  it("outputs empty JSON when no infra_repos", async () => {
    const { stdout, exitCode } = await run(["infra", "--json"], { HOP_CONFIG_PATH: MINIMAL });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.repos).toEqual([]);
  });
});

describe("hop --version", () => {
  it("prints version", async () => {
    const { stdout, exitCode } = await run(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe("0.1.0");
  });
});

describe("hop --help", () => {
  it("lists all commands", async () => {
    const { stdout, exitCode } = await run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("HarnessOps CLI");
    expect(stdout).toContain("init");
    expect(stdout).toContain("validate");
    expect(stdout).toContain("projects");
    expect(stdout).toContain("machine");
    expect(stdout).toContain("discover");
    expect(stdout).toContain("infra");
  });
});
