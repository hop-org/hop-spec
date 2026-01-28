# CLI Framework Decision: `hop` CLI

**Decision**: Node.js + TypeScript with Commander.js
**Date**: 2026-01-27
**Status**: DECIDED

---

## Context

The `hop` CLI needs to:
- `hop init` — Interactive hop.json creation
- `hop validate` — Validate hop.json against JSON Schema (Draft 2020-12)
- `hop projects` — List projects from hop.json
- `hop path <name>` — Resolve a project path
- `hop machine` — Show machine info
- `hop discover` — Auto-scan for projects, git repos, tools

A companion MCP server will also be built to expose hop.json data to AI agents.

## Options Evaluated

| Criterion | Rust + clap | Node + commander | Bun | Deno |
|-----------|:-----------:|:----------------:|:---:|:----:|
| JSON Schema validation | jsonschema-rs (good) | AJV (gold standard) | AJV via npm | AJV via npm |
| MCP SDK compatibility | Separate impl needed | Native (TS SDK) | Partial compat | Partial compat |
| Code sharing (CLI ↔ MCP) | None (different lang) | Full (same codebase) | Full | Full |
| Distribution: npm | No | Yes (native) | Yes | Yes |
| Distribution: brew | Manual tap | Via npm | Manual | Manual |
| Single binary | Built-in | pkg/sea | bun build --compile | deno compile |
| Binary size | ~5MB | ~50MB (pkg) | ~50MB | ~80MB |
| Dev speed | Slower (compile) | Fast | Fast | Fast |
| Ecosystem maturity | Mature | Mature | Maturing | Mature |
| Cross-platform | Excellent | Excellent | Good | Excellent |

## Decision: Node.js + TypeScript

### Why

1. **MCP SDK is TypeScript**. The MCP server (`@modelcontextprotocol/sdk`) is a TypeScript package. Building the CLI in TypeScript means the CLI and MCP server share the same hop.json parser, validator, and discovery logic. One codebase, two entry points.

2. **AJV is the gold standard** for JSON Schema validation. It supports Draft 2020-12, has excellent error messages, and is battle-tested. The Rust jsonschema crate is good but less mature for Draft 2020-12.

3. **npm distribution is frictionless**. `npm install -g hop-cli` works everywhere Node.js is installed. For the target audience (AI coding agent users), Node.js is virtually always available.

4. **Development velocity matters more than binary size** for a v0.1. We need to ship the CLI quickly to break the chicken-and-egg problem (spec without consumers). TypeScript lets us iterate faster than Rust.

5. **Single binary is a later optimization**. If needed, we can use `pkg`, Bun's `--compile`, or Node's SEA (Single Executable Applications) to produce standalone binaries. This is a distribution concern, not an architecture concern.

### Why not Rust

- Forces a separate codebase from the MCP server (which must be TypeScript)
- Slower development velocity for a v0.1 that needs to ship fast
- JSON Schema Draft 2020-12 support is less mature than AJV
- The performance advantage is irrelevant — this CLI parses a single JSON file

### Why not Bun/Deno

- MCP SDK officially targets Node.js. Bun/Deno compatibility is partial and may break
- Smaller ecosystem for production CLI tooling
- Added risk for a v0.1 without compensating benefit
- Can always port later if Bun/Deno become the better choice

## Package Structure

```
packages/
  hop-core/        # Shared: parser, validator, discovery, types
  hop-cli/         # CLI entry point (commander.js)
  hop-mcp/         # MCP server entry point (@modelcontextprotocol/sdk)
```

Monorepo with shared core. CLI and MCP server are thin wrappers around `hop-core`.

## Key Dependencies

- `commander` — CLI framework (zero deps, TypeScript support)
- `ajv` — JSON Schema Draft 2020-12 validation
- `ajv-formats` — Format validation (uri, email, etc.)
- `inquirer` — Interactive prompts for `hop init`
- `@modelcontextprotocol/sdk` — MCP server (hop-mcp only)

## Distribution Plan

1. **npm** (v0.1): `npm install -g @harnessops/cli`
2. **npx** (v0.1): `npx @harnessops/cli init`
3. **brew** (v0.2+): Homebrew tap via npm bridge
4. **Binary** (v0.2+): Node SEA or pkg for standalone distribution
