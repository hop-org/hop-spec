import { describe, test, expect } from "bun:test";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dir, "..", "dist", "cli.js");
// Use a temp HOME so ~/.hop/settings.json doesn't override HOP_CONFIG_PATH
const ISOLATED_HOME = join(tmpdir(), `hop-bundle-test-${process.pid}`);
const TEST_ENV = {
  ...process.env,
  HOME: ISOLATED_HOME,
  HOP_CONFIG_PATH: join(import.meta.dir, "..", "..", "..", "spec", "examples", "hop-example-local-dev.json"),
};

function run(args: string): string {
  return execSync(`node ${CLI} ${args}`, {
    encoding: "utf-8",
    env: TEST_ENV,
  }).trim();
}

function runJSON(args: string): unknown {
  return JSON.parse(run(`${args} --json`));
}

function runFail(args: string): string {
  try {
    execSync(`node ${CLI} ${args}`, {
      encoding: "utf-8",
      env: TEST_ENV,
      stdio: ["pipe", "pipe", "pipe"],
    });
    throw new Error("Expected command to fail");
  } catch (err: any) {
    return err.stderr?.trim() ?? err.message;
  }
}

describe("hop bundles", () => {
  test("lists bundles in table format", () => {
    const output = run("bundles");
    expect(output).toContain("ID");
    expect(output).toContain("NAME");
    expect(output).toContain("PROJECTS");
    expect(output).toContain("personal");
  });

  test("lists bundles as JSON", () => {
    const bundles = runJSON("bundles") as any[];
    expect(Array.isArray(bundles)).toBe(true);
    expect(bundles.length).toBeGreaterThanOrEqual(1);
    expect(bundles[0]).toHaveProperty("id");
    expect(bundles[0]).toHaveProperty("name");
    expect(bundles[0]).toHaveProperty("projects");
  });
});

describe("hop bundle <id>", () => {
  test("shows bundle details", () => {
    const output = run("bundle personal");
    expect(output).toContain("Bundle:");
    expect(output).toContain("personal");
    expect(output).toContain("Projects:");
  });

  test("shows bundle as JSON", () => {
    const bundle = runJSON("bundle personal") as any;
    expect(bundle).toHaveProperty("id", "personal");
    expect(bundle).toHaveProperty("name");
    expect(bundle).toHaveProperty("projects");
    expect(Array.isArray(bundle.projects)).toBe(true);
  });

  test("errors on missing bundle", () => {
    const output = runFail("bundle nonexistent");
    expect(output).toContain("not found");
    expect(output).toContain("Available bundles:");
  });
});
