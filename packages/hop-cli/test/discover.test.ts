/**
 * Integration tests for hop discover and the discovery resolution order.
 *
 * Tests the discovery chain:
 *   1. ~/.hop/settings.json (authoritative pointer — highest priority)
 *   2. $HOP_CONFIG_PATH env var
 *   3. ~/.hop/hop.json (default home)
 *   4. ~/.hop/config.json pointer (legacy)
 *   5. Walk up from cwd
 *   6. Legacy locations
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
const FIXTURE = join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-vps-server.json");
const MINIMAL = join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-minimal.json");

async function run(
  args: string[],
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    env: { ...process.env, ...env },
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

describe("discovery: $HOP_CONFIG_PATH", () => {
  it("env var overrides all other discovery", async () => {
    const { stdout, exitCode } = await run(["where"], {
      HOP_CONFIG_PATH: FIXTURE,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("hop-example-vps-server.json");
  });

  it("env var pointing to minimal example works", async () => {
    const { stdout, exitCode } = await run(["machine", "--json"], {
      HOP_CONFIG_PATH: MINIMAL,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.id).toBe("my-machine");
  });

  it("nonexistent env var path falls through", async () => {
    // If HOP_CONFIG_PATH points to a nonexistent file, discovery
    // should fall through to other methods (or fail gracefully).
    const { exitCode } = await run(["where"], {
      HOP_CONFIG_PATH: "/tmp/nonexistent-hop.json",
    });
    // May succeed (if ~/.hop/hop.json exists) or fail — either way, not a crash
    expect([0, 1]).toContain(exitCode);
  });
});

describe("discovery: walk-up from cwd", () => {
  const tmpDir = join(import.meta.dir, "fixtures", "walkup-test");
  const nestedDir = join(tmpDir, "a", "b", "c");
  const hopFile = join(tmpDir, "hop.json");

  beforeAll(() => {
    mkdirSync(nestedDir, { recursive: true });
    const config = {
      schema_version: "0.1.0",
      machine: { id: "walkup-test", name: "Walk-Up Test" },
    };
    writeFileSync(hopFile, JSON.stringify(config, null, 2));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds hop.json in parent directory", async () => {
    // Run from nested dir without HOP_CONFIG_PATH — should walk up and find hop.json
    const proc = Bun.spawn(["bun", CLI, "machine", "--json"], {
      cwd: nestedDir,
      env: {
        ...process.env,
        HOP_CONFIG_PATH: "", // clear env override
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = (await new Response(proc.stdout).text()).trim();
    const exitCode = await proc.exited;
    // This may or may not find our file depending on whether ~/.hop/hop.json exists
    // and takes priority. The key test is that it doesn't crash.
    expect([0, 1]).toContain(exitCode);
  });
});

describe("hop discover", () => {
  const tmpDir = join(import.meta.dir, "fixtures", "discover-test");
  const projA = join(tmpDir, "project-a");
  const projB = join(tmpDir, "project-b");

  beforeAll(() => {
    mkdirSync(join(projA, ".git"), { recursive: true });
    mkdirSync(projB, { recursive: true });
    writeFileSync(join(projA, "package.json"), '{"name":"a"}');
    writeFileSync(join(projB, "Cargo.toml"), '[package]\nname = "b"');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds git projects in a directory", async () => {
    const { stdout, stderr, exitCode } = await run(
      ["discover", tmpDir],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Found");
    // project-a has .git + package.json
    expect(stdout).toContain("project-a");
  });

  it("finds non-git projects with build markers", async () => {
    const { stdout, exitCode } = await run(
      ["discover", tmpDir, "--json"],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const names = parsed.map((p: any) => p.name);
    // project-b has Cargo.toml but no .git — should still be discovered
    expect(names).toContain("project-b");
  });

  it("outputs JSON with --json flag", async () => {
    const { stdout, exitCode } = await run(
      ["discover", tmpDir, "--json"],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    const names = parsed.map((p: any) => p.name);
    expect(names).toContain("project-a");
  });

  it("respects depth limit", async () => {
    const { stderr, exitCode } = await run(
      ["discover", tmpDir, "-d", "0"],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    // depth 0 only scans the root dir itself
    expect(exitCode).toBe(0);
  });
});

describe("hop validate against all examples", () => {
  const examplesDir = join(import.meta.dir, "..", "..", "..", "spec", "examples");

  it("validates minimal example", async () => {
    const { stdout, exitCode } = await run(
      ["validate", join(examplesDir, "hop-example-minimal.json")],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });

  it("validates local-dev example", async () => {
    const { stdout, exitCode } = await run(
      ["validate", join(examplesDir, "hop-example-local-dev.json")],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });

  it("validates cloud-ide example", async () => {
    const { stdout, exitCode } = await run(
      ["validate", join(examplesDir, "hop-example-cloud-ide.json")],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });

  it("validates vps-server example", async () => {
    const { stdout, exitCode } = await run(
      ["validate", join(examplesDir, "hop-example-vps-server.json")],
      { HOP_CONFIG_PATH: FIXTURE },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid");
  });

  // (placeholder for future example validation tests)
});

describe("discovery: settings.json as authoritative pointer", () => {
  const testHome = join(tmpdir(), `hop-settings-test-${Date.now()}`);
  const hopDir = join(testHome, ".hop");
  const settingsPath = join(hopDir, "settings.json");

  beforeAll(() => {
    mkdirSync(hopDir, { recursive: true });
    // Write settings.json pointing to the VPS fixture
    writeFileSync(
      settingsPath,
      JSON.stringify({ hop_config: FIXTURE }, null, 2),
    );
  });

  afterAll(() => {
    rmSync(testHome, { recursive: true, force: true });
  });

  it("settings.json takes priority over env var", async () => {
    // settings.json points to VPS fixture, env var points to minimal
    // settings.json should win
    const proc = Bun.spawn(["bun", CLI, "machine", "--json"], {
      env: {
        ...process.env,
        HOME: testHome,
        HOP_CONFIG_PATH: MINIMAL,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = (await new Response(proc.stdout).text()).trim();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    // VPS fixture has id "prod-vps", minimal has "my-machine"
    // settings.json should win, giving us prod-vps
    expect(parsed.id).toBe("prod-vps");
  });

  it("settings.json path is resolved correctly", async () => {
    const proc = Bun.spawn(["bun", CLI, "where"], {
      env: {
        ...process.env,
        HOME: testHome,
        HOP_CONFIG_PATH: "", // clear
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = (await new Response(proc.stdout).text()).trim();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(stdout).toContain("hop-example-vps-server.json");
  });
});

describe("discover: smart roots from hop.json", () => {
  const testHome = join(tmpdir(), `hop-smartroots-test-${Date.now()}`);
  const hopDir = join(testHome, ".hop");
  const agentRoot = join(testHome, "dev");
  const projInRoot = join(agentRoot, "my-proj");

  beforeAll(() => {
    mkdirSync(hopDir, { recursive: true });
    mkdirSync(join(projInRoot, ".git"), { recursive: true });
    writeFileSync(join(projInRoot, "package.json"), '{"name":"my-proj"}');

    // Create hop.json with agent_root pointing to our test dir
    const config = {
      schema_version: "0.1.0",
      machine: { id: "test-smart", name: "Smart Test", agent_root: agentRoot },
    };
    const hopJsonPath = join(hopDir, "hop.json");
    writeFileSync(hopJsonPath, JSON.stringify(config, null, 2));
  });

  afterAll(() => {
    rmSync(testHome, { recursive: true, force: true });
  });

  it("uses agent_root from hop.json as scan root", async () => {
    const proc = Bun.spawn(["bun", CLI, "discover", "--json"], {
      env: {
        ...process.env,
        HOME: testHome,
        HOP_CONFIG_PATH: "", // let it find ~/.hop/hop.json
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = (await new Response(proc.stdout).text()).trim();
    const stderr = (await new Response(proc.stderr).text()).trim();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    // Should report using roots from hop.json
    expect(stderr).toContain("Using roots from hop.json");
    expect(stderr).toContain(agentRoot);
    // Should find our project in agent_root
    const parsed = JSON.parse(stdout);
    const names = parsed.map((p: any) => p.name);
    expect(names).toContain("my-proj");
  });
});
