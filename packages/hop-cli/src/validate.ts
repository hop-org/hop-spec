/**
 * hop validate — Validate hop.json against the HarnessOps JSON Schema.
 *
 * Uses AJV (Draft 2020-12) for validation with ajv-formats for URI etc.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

// Handle both CJS and ESM default exports
const Ajv = (Ajv2020 as any).default ?? Ajv2020;
const applyFormats = (addFormats as any).default ?? addFormats;
import { discoverHopPath } from "@harnessops/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve the bundled schema path (spec/hop-schema.json relative to repo root). */
function findBundledSchema(): string | null {
  // Walk up from __dirname to find spec/hop-schema.json
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "spec", "hop-schema.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

interface ValidateOptions {
  file?: string;
  schemaPath?: string;
}

export async function runValidate(opts: ValidateOptions): Promise<void> {
  // 1. Resolve hop.json file
  let hopPath: string;
  if (opts.file) {
    hopPath = resolve(opts.file);
  } else {
    const discovered = discoverHopPath();
    if (!discovered) {
      console.error("Error: No hop.json found.");
      console.error("Searched: $HOP_CONFIG_PATH, parent directories, ~/.config/hop/, /etc/hop/");
      console.error("Specify a file: hop validate /path/to/hop.json");
      process.exit(1);
      return;
    }
    hopPath = discovered;
  }

  if (!existsSync(hopPath)) {
    console.error(`Error: File not found: ${hopPath}`);
    process.exit(1);
    return;
  }

  // 2. Parse JSON
  let doc: unknown;
  try {
    const raw = readFileSync(hopPath, "utf-8");
    doc = JSON.parse(raw);
  } catch (err: any) {
    console.error(`Error: Invalid JSON in ${hopPath}`);
    console.error(`  ${err.message}`);
    process.exit(1);
    return;
  }

  // 3. Load schema
  let schemaPath: string;
  if (opts.schemaPath) {
    schemaPath = resolve(opts.schemaPath);
  } else {
    const bundled = findBundledSchema();
    if (!bundled) {
      console.error("Error: Could not find bundled hop-schema.json.");
      console.error("Specify a schema: hop validate --schema /path/to/hop-schema.json");
      process.exit(1);
      return;
    }
    schemaPath = bundled;
  }

  let schema: unknown;
  try {
    schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  } catch (err: any) {
    console.error(`Error: Invalid schema file: ${schemaPath}`);
    console.error(`  ${err.message}`);
    process.exit(1);
    return;
  }

  // 4. Validate
  const ajv = new Ajv({ allErrors: true, strict: false });
  applyFormats(ajv);

  const validate = ajv.compile(schema as object);
  const valid = validate(doc);

  if (valid) {
    console.log(`✓ Valid: ${hopPath}`);
    console.log(`  Schema: ${schemaPath}`);
    process.exit(0);
  } else {
    console.error(`✗ Invalid: ${hopPath}`);
    console.error(`  Schema: ${schemaPath}`);
    console.error("");
    for (const err of validate.errors ?? []) {
      const path = err.instancePath || "/";
      console.error(`  ${path}: ${err.message}`);
      if (err.params) {
        const details = Object.entries(err.params)
          .filter(([k]) => k !== "type")
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ");
        if (details) console.error(`    (${details})`);
      }
    }
    process.exit(1);
  }
}
