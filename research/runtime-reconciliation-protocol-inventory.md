# Runtime Reconciliation Protocol Inventory

## Keep HOP Small

The operational coverage is useful, but HOP should stay easy for a human to read and easy for an agent to maintain.

That means:

- HOP should describe machine facts that are hard to infer.
- The reconciliation/reporting tool should own comparison logic, recommendations, and rollout advice.
- We should resist turning `hop.json` into a deployment policy engine.

This document reframes the earlier proposal around that smaller target.

## Case Study First, Schema Later

The preferred adoption pattern is:

- document good machine-local patterns as case studies first
- keep using flexible `additionalProperties` or extension-style objects locally
- only standardize fields when shared HOP tooling actually depends on them

That means a pattern can be "blessed" in docs without becoming mandatory in the
schema.

The threshold for moving something into core should be:

- multiple machines are using the same field shape
- the meaning is stable and easy to explain
- a CLI or MCP feature needs the field to behave consistently

## What The Protocol Actually Needs To Support

For runtime reconciliation, the protocol only needs to answer a few durable questions:

1. What services on this machine are important enough to track?
2. If a service is backed by source code, what repo is that source expected to come from?
3. Should that source repo be cloned on this machine?
4. Which infra repos are intentionally local vs optional?

Everything else can be derived or handled by the reporting layer.

## Minimal Candidate Core Additions

### 1. Clarify service inventory

The docs should explicitly say that the machine service inventory may come from:

- `services.*`
- `assistant`
- `automation.platform`

This is mostly a documentation clarification, not a schema expansion.

### 2. Add source-clone linkage on service-like objects

Minimal useful fields:

- `source_repo`
- `expected_clone`

Why these matter:

- They let automation detect `openclaw`-style cases where a runtime exists but no infra clone is present.
- They are not reliably discoverable from the filesystem.
- They stay understandable: "this service comes from that repo, and I do or do not expect the repo to exist here."

Recommended example:

```json
{
  "services": {
    "cass_cm": {
      "url": "http://127.0.0.1:8765/mcp/",
      "source_repo": "cass-cm-mcp",
      "expected_clone": true,
      "description": "CASS + CM MCP server"
    }
  }
}
```

### 3. Add clone intent on infra repos

Minimal useful field:

- `clone_policy`: `required | preferred | on-demand`

Why this matters:

- It distinguishes "missing and broken" from "not cloned here by design."
- It is simple enough for humans to maintain.
- It avoids inventing per-machine policy prose in `AGENTS.md`.

Recommended example:

```json
{
  "infra_repos": {
    "path": "/home/ubuntu/infra-repo-clones",
    "repos": [
      { "name": "agent-mail", "clone_policy": "required" },
      { "name": "wa", "clone_policy": "on-demand" }
    ]
  }
}
```

## What Should Stay Out Of Core For Now

These fields are useful locally, but they should stay as machine conventions until multiple adopters prove they are worth standardizing:

- `tier`
- `visibility`
- `runtime`
- `update_policy`
- recommendation/risk/timing metadata

Why keep them local:

- They are helpful for reporting, but they are not the minimum needed for HOP to remain useful.
- They drift toward workflow policy, which belongs in tools like the reconciliation reporter or n8n.
- They increase cognitive load faster than they increase portability.

## Local Conventions We Can Keep Using

This VPS can still use richer local metadata under `additionalProperties`, because that gives us operational leverage without forcing the full shape into the public protocol.

Current useful local conventions:

- `services.<id>.type`
- `services.<id>.tier`
- `services.<id>.visibility`
- `infra_repos.repos[*].runtime`
- `infra_repos.repos[*].update_policy`

That is acceptable as long as the public docs clearly distinguish:

- "small HOP core"
- "machine-local conventions consumed by higher-level automation"

## Reporting Layer Responsibilities

The reconciliation tool, not HOP itself, should handle:

- comparing clone state vs runtime state
- computing drift
- suggesting update timing
- summarizing upstream commit deltas
- deciding whether to recommend update now, wait, or manually review

In other words:

- HOP says what exists and what should be present.
- The reporter says what to do about it.

## Recommended Documentation Changes

The public `hop-spec` docs should add a short guidance section that says:

1. Use `source_repo` and `expected_clone` when a service is backed by a source repo.
2. Use `clone_policy` on infra repos to distinguish required vs optional local clones.
3. Treat `assistant` and `automation.platform` as part of the machine's service inventory.
4. Keep richer runtime/update metadata as local conventions unless and until the pattern stabilizes.

That gives adopters a clear path without making the protocol feel heavy.

## Bottom Line

The protocol should not absorb the full reconciliation workflow.

The smallest HOP shape that unlocks this feature set is:

- service-to-repo linkage: `source_repo`
- service clone expectation: `expected_clone`
- infra repo intent: `clone_policy`
- documentation that `services`, `assistant`, and `automation.platform` all participate in service inventory

Everything beyond that should stay in the reporting/orchestration layer for now.
