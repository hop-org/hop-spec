# Extension Registry Models: How Open Standards Handle Third-Party Configuration

> **Key Question:** Should hop.json maintain a central registry of tool configs, or should each tool (e.g. Basic Memory, Beads, MCP servers) declare their own hop.json requirements in their own repos?
>
> **TL;DR Recommendation:** Decentralized self-declaration with a thin community index. Tools own their schemas in their repos. Hop publishes conventions + an optional discovery index. This is the dominant modern pattern and the right fit for hop.json's stage and goals.

---

## Table of Contents

1. [Model 1: Central Registry](#1-central-registry-model)
2. [Model 2: Decentralized / Self-Declared](#2-decentralized--self-declared-model)
3. [Model 3: Hybrid](#3-hybrid-model)
4. [Model 4: JSON Schema Composition / Plugin Config](#4-json-schema-composition--plugin-config)
5. [Comparison Matrix](#comparison-matrix)
6. [Recommendation for hop.json](#recommendation-for-hopjson)
7. [Implementation Sketch](#implementation-sketch)

---

## 1. Central Registry Model

A single repository or service acts as the canonical source for all third-party contributions. Contributors submit PRs to the central repo. Maintainers review and merge.

### 1a. DefinitelyTyped (`@types/*`)

**Source:** [github.com/DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) — 50.9k stars, 30.6k forks

**How it works:**
- Single massive monorepo (now pnpm monorepo) containing type definitions for ~9,000+ npm packages
- Each package lives in `types/<package-name>/` with `index.d.ts`, test files, `tsconfig.json`, `package.json`, and `.eslintrc.json`
- Contributors fork the repo, create type definitions following the standard structure, then open a PR
- CI runs `dtslint` (TypeScript type-checking + linting) on every PR
- An automated bot (`dt-mergebot`) handles the merge lifecycle — it pings package owners listed in the `package.json` header, auto-merges if CI passes and owners approve (or after 7 days of no response)
- Merged definitions are automatically published to npm under `@types/<package>` namespace via a separate publisher tool

**Key details from the README:**
> "We use a bot to let a large number of pull requests to DefinitelyTyped be handled entirely in a self-service manner."

Contributors are told: "If you are the library author and your package is written in TypeScript, **bundle the generated declaration files in your package** instead of publishing to Definitely Typed." — This directly shows the pressure toward decentralization. The preferred model is self-hosted types; DT exists as a fallback for packages that don't bundle their own.

**The escape valve:** TypeScript itself supports types bundled directly in npm packages (`"types"` field in `package.json`). DefinitelyTyped is explicitly positioned as a fallback for packages that don't yet bundle their own types. The ecosystem is migrating away from central.

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🔴 Very High — Microsoft sponsors infrastructure, full-time bot maintenance, 777-line README of contribution rules |
| **Discoverability** | 🟢 Excellent — `npm install @types/foo` is seamless, TypeScript suggests missing types |
| **Version compatibility** | 🟡 Moderate — Type versions can lag behind packages; manual semver convention alignment |
| **Adoption friction** | 🟡 Moderate — Must follow DT conventions, wait for review, learn pnpm monorepo setup |

### 1b. Homebrew Core (`homebrew/core`)

**Source:** [docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request](https://docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request)

**How it works:**
- Central repo with one Ruby formula file per package in `homebrew/core`
- Contributors fork, create/edit formula, must pass `brew audit --strict --online` before submitting PR
- Maintainers review with strict quality standards ("Acceptable Formulae" criteria)
- Binary bottles built via CI after merge
- Helper CLI: `brew bump-formula-pr` automates fork/commit/push for version bumps

**The escape valve — Taps (critical design decision):**

From [docs.brew.sh/Taps](https://docs.brew.sh/Taps):
> "The `brew tap` command adds more repositories to the list of formulae that Homebrew tracks, updates, and installs from."

Any GitHub repo matching `homebrew-<name>` can be tapped. This creates a **two-tier system**:
- **Central** (`homebrew/core`): Curated, reviewed, bottled — for popular stable software
- **Decentralized** (taps): Self-published, no review needed — for niche/fast-moving/opinionated packages

Name collision handling is explicit: `brew install vim` → core; `brew install username/repo/vim` → tap version. The README states there is "intentionally no way of replacing dependencies of core formulae with those from other taps."

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🔴 High for core — ~25 active maintainers, strict quality standards |
| **Discoverability** | 🟢 Excellent for core, 🔴 Poor for taps (must know URL) |
| **Version compatibility** | 🟢 Good — Formulae pin versions explicitly |
| **Adoption friction** | 🟡 Moderate for core (PR + review), 🟢 Low for taps (self-serve) |

### 1c. Docker Official Images

**Source:** [github.com/docker-library/official-images](https://github.com/docker-library/official-images)

**How it works:**
- Central repo with library definition files (not Dockerfiles themselves — those live in upstream repos)
- Each image has a manifest file pointing to the upstream Dockerfile repo, tags, and architectures
- Extremely strict review process with explicit checklist (`NEW-IMAGE-CHECKLIST.md`)

From the README — Review Guidelines cover:
- **Maintainership:** "Version bumps and security fixes should be attended to in a timely manner"
- **Repeatability:** "Rebuilding the same Dockerfile should result in the same version"
- **Consistency:** "A beginning user should be able to `docker run official-image bash`"
- **Security:** Build-time and runtime checks, plus security releases commitment
- **No non-official dependencies:** "No official images can be derived from, or depend on, non-official images"

Upstream maintainers are encouraged to take over: "For upstreams interested in taking over maintainership of an existing repository, the first step is to get involved in the existing repository." There's even a transfer process using intermediary GitHub organizations.

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🔴 Extreme — Only ~200 official images exist because the bar is very high |
| **Discoverability** | 🟢 Excellent — Built into Docker Hub UI |
| **Version compatibility** | 🟢 Excellent — Strict version pinning enforced |
| **Adoption friction** | 🔴 Very High — Multi-point checklist, ongoing maintenance commitment required |

### 1d. VS Code Extension Marketplace

**Source:** [code.visualstudio.com/api/working-with-extensions/publishing-extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

**How it works:**
- Authors create a "publisher" account via Azure DevOps
- Extensions are packaged as `.vsix` files using `vsce` CLI tool
- Published via `vsce publish` to marketplace.visualstudio.com
- Automated checks: no user-provided SVGs, HTTPS image URLs required, badge restrictions
- No human review gate — automated scanning only

This is actually a **service-based central registry** rather than a PR-based one. The marketplace is infrastructure, not a code repo. Authors retain full control of their code but submit artifacts to a central distribution point.

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟡 Moderate — Microsoft runs infrastructure; automated review only |
| **Discoverability** | 🟢 Excellent — Built into VS Code UI with search, ratings, install counts |
| **Version compatibility** | 🟢 Good — Semver enforced, `vsce publish minor` auto-increments |
| **Adoption friction** | 🟡 Moderate — Azure DevOps account + PAT required |

### 1e. SchemaStore

**Source:** [github.com/SchemaStore/schemastore](https://github.com/SchemaStore/schemastore)

**How it works:**
- Central repository containing JSON schemas for popular configuration files
- Schema files live in `src/schemas/json/`, each with an entry in `catalog.json`
- The `catalog.json` maps schemas to `fileMatch` patterns (e.g., `tsconfig.json` → TypeScript schema)
- IDEs and language servers (VS Code, IntelliJ, yaml-language-server) consume the catalog for auto-completion
- Contributors submit PRs to add or modify schemas; tests validate against positive/negative fixtures
- Uses `draft-07` JSON Schema by recommendation

**Critical design detail — supports self-hosted schemas:**

From CONTRIBUTING.md, there are two paths:
- **Hosted in SchemaStore:** Schema file lives in the repo, with tests
- **Self-hosted/external:** Only a catalog entry pointing to an external URL is added

> "How to add a JSON Schema that's self-hosted/remote/external" is a documented first-class path.

This means SchemaStore is a **hybrid** — it's a central catalog that can index both local and remote schemas.

**Best practices reveal extensibility concerns:**
> "Do not blindly add `additionalProperties: false`. Keep in mind that: New properties supported by a new tool version (and not yet added to SchemaStore) should NOT error. The schema may be extended by a tool that you have no knowledge of."

This advice directly applies to hop.json's extension design.

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟡 Moderate — PR-based, volunteer-driven, requesting sponsorship |
| **Discoverability** | 🟢 Excellent — IDE integration is transparent to users |
| **Version compatibility** | 🟡 Moderate — Schemas can lag behind tools |
| **Adoption friction** | 🟢 Low — Submit a PR, or just point to your own URL |

---

## 2. Decentralized / Self-Declared Model

Each tool/service publishes its own configuration, schema, or specification in its own repository. No central authority gates what can be published.

### 2a. Dev Container Features (OCI Distribution)

**Source:** [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)

This is the **strongest precedent** for hop.json's extension model. The spec explicitly states its goals:

> "For Feature authors, create a **'self-service' way to publish a Feature, either publicly or privately, that is not centrally controlled.**"

**How it works:**
- Each author creates a git repo with a standard structure: `src/<feature-id>/devcontainer-feature.json` + `install.sh`
- Features are packaged as tarballs and published as **OCI artifacts** to any OCI-compliant registry (GHCR, Docker Hub, etc.)
- Naming convention: `<registry>/<namespace>/<id>[:version]` — e.g., `ghcr.io/devcontainers/features/go:1.2.3`
- Each feature is independently semver'd via the `version` field in `devcontainer-feature.json`
- An auto-generated `devcontainer-collection.json` metadata file accompanies each collection
- A template repo (`devcontainers/feature-template`) makes bootstrapping trivial

**The metadata file (`devcontainer-feature.json`) is key:**
```json
{
  "id": "go",
  "version": "1.2.3",
  "name": "Go",
  "description": "Installs Go",
  "options": {
    "version": { "type": "string", "default": "latest" }
  },
  "customizations": {
    "vscode": { "extensions": ["golang.go"] }
  },
  "installsAfter": ["ghcr.io/devcontainers/features/common-utils"]
}
```

**Discovery mechanisms:**
- OCI registry queries
- `devcontainer-collection.json` pushed to registry alongside features
- `dev.containers.metadata` annotation on OCI manifests contains the full feature JSON
- Community indexes (containers.dev lists known features) but these are optional

**Also supports local development:**
Features can be referenced locally during development: `"features": { "./localFeatureA": {} }` — with the constraint that they must live inside `.devcontainer/`.

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟢 Minimal — Spec defines structure, not content. Authors self-serve entirely |
| **Discoverability** | 🟡 Moderate — OCI registry queries + optional community listing |
| **Version compatibility** | 🟢 Good — Semver + OCI tags provide reliable pinning |
| **Adoption friction** | 🟢 Very Low — Template repo, no review, publish in minutes |

### 2b. MCP (Model Context Protocol) Servers

**Source:** [modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle)

**How it works:**
- Each MCP server declares its capabilities at **runtime** via the `initialize` handshake
- The initialization request/response exchanges:
  - Protocol version compatibility
  - Client capabilities (`roots`, `sampling`)
  - Server capabilities (`prompts`, `resources`, `tools`, `logging`, `completions`)
- Each capability can declare sub-capabilities (e.g., `listChanged` for notifications)
- No registry required for functionality — capabilities are negotiated per-session

**Key protocol exchange:**
```json
// Server responds with its capabilities:
{
  "capabilities": {
    "logging": {},
    "prompts": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true },
    "tools": { "listChanged": true }
  },
  "serverInfo": { "name": "ExampleServer", "version": "1.0.0" }
}
```

**Discovery is external to the protocol:**
- Community indexes exist (mcp.so, Smithery, GitHub MCP Registry) for human discovery
- But the protocol itself only defines runtime negotiation
- Each server is a standalone package (npm, pip, binary, Docker image)

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟢 Near-zero — Protocol defines negotiation format, nothing else |
| **Discoverability** | 🔴 Poor without community indexes — Runtime discovery only works post-install |
| **Version compatibility** | 🟢 Good — Protocol version negotiation is built into the handshake |
| **Adoption friction** | 🟢 Low — No gatekeeping, implement the protocol and ship |

### 2c. OpenAPI Specifications

**How it works:**
- Each API provider publishes their own OpenAPI spec (YAML/JSON) in their own repo or at a well-known URL
- No central registry required for functionality
- The OpenAPI Initiative maintains the **spec format**, not individual API specs
- Optional aggregators exist: APIs.guru, SwaggerHub, Postman collections — but none are required
- OpenAPI Generator (the tooling ecosystem) supports customization via config files with `files:` nodes for extending templates

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟢 Minimal — OAI maintains spec format only |
| **Discoverability** | 🟡 Variable — Well-known URLs help; no single search |
| **Version compatibility** | 🟢 Good — Spec versioning is independent of individual API specs |
| **Adoption friction** | 🟢 Low — Write a YAML file, publish anywhere |

---

## 3. Hybrid Model

Tools self-publish and maintain their own code/config, but register with a central directory for discoverability.

### 3a. Terraform Provider Registry

**Source:** [developer.hashicorp.com/terraform/registry/providers](https://developer.hashicorp.com/terraform/registry/providers) and [.../publishing](https://developer.hashicorp.com/terraform/registry/providers/publishing)

**How it works:**
- Providers live in their own GitHub repos following the naming convention `terraform-provider-{NAME}` (lowercase, public)
- Provider authors **publish releases via GitHub Releases** — Git tags must be valid semver with `v` prefix
- The Terraform Registry auto-indexes new versions from GitHub releases
- A `terraform-registry-manifest.json` file in each release provides metadata (protocol versions, etc.)
- GPG signing required for release integrity

**Registration process:**
> "Anyone can publish and share a provider by signing into the Registry using their GitHub account and following a few additional steps."

**Tier system provides trust signals without gatekeeping:**

| Tier | Description | Namespace |
|------|-------------|-----------|
| Official | Owned by HashiCorp | `hashicorp` |
| Partner Premier | Qualified third-party partners | Third-party org |
| Partner | Validated via HashiCorp Technology Partner Program | Third-party org |
| Community | Published by anyone | Individual/org account |
| Archived | No longer maintained | Original namespace |

**Key insight:** The registry is a **thin index** over self-hosted repos. Providers do NOT submit code to HashiCorp. They maintain their own repos and the registry pulls metadata. The tier system adds trust signals without adding gatekeeping to the publishing process.

**Built into CLI:**
```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```
`terraform init` automatically downloads from the registry.

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟢 Low — HashiCorp maintains registry infra; code stays with authors |
| **Discoverability** | 🟢 Excellent — registry.terraform.io is the single search destination |
| **Version compatibility** | 🟢 Excellent — Semver enforced, CLI resolves constraints |
| **Adoption friction** | 🟢 Low — Self-serve publishing via GitHub, optional partner program |

### 3b. Kubernetes CRDs (Custom Resource Definitions)

**Source:** [kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)

**How it works:**
- Anyone can define a CRD and install it on any cluster — dynamic registration, no central approval
- CRDs are themselves Kubernetes resources: you apply a YAML defining your custom type
- Some CRDs are "built-in" (core Kubernetes), others come from operators (cert-manager, Istio, etc.)
- Validation via OpenAPI v3.0 schemas embedded in the CRD definition
- **API group provides namespace**: `certificates.cert-manager.io/v1` — natural collision prevention

**Discovery:**
- OperatorHub.io — optional community catalog for operators that include CRDs
- ArtifactHub.io — indexes Helm charts which often include CRDs
- Neither is required for CRD functionality

**Key insight from the docs — CRDs vs. ConfigMaps decision:**
The K8s docs explicitly compare when to use CRDs vs ConfigMaps. CRDs are recommended when:
- You want to use Kubernetes client libraries and CLIs
- You want `kubectl get my-object object-name`
- You want automation that watches for updates
- You want the object to be an abstraction over controlled resources

This decision framework is relevant to hop.json: should extensions be structured data (like CRDs) or opaque blobs (like ConfigMaps)?

| Dimension | Assessment |
|-----------|-----------|
| **Governance overhead** | 🟢 Minimal for the mechanism — Anyone can create CRDs |
| **Discoverability** | 🟡 Moderate — OperatorHub exists but coverage is incomplete |
| **Version compatibility** | 🟡 Moderate — CRDs support multi-version with conversion webhooks |
| **Adoption friction** | 🟢 Low for simple CRDs, 🟡 Moderate for full operators |

### 3c. Homebrew Taps (the escape valve)

As described in [Section 1b](#1b-homebrew-core-homebrewcore), Homebrew taps create a decentralized layer alongside the centralized core. The hybrid works because:
- Central provides trust + discoverability for popular packages
- Taps provide autonomy + speed for everything else
- Fully qualified names prevent collisions: `user/repo/formula`

---

## 4. JSON Schema Composition / Plugin Config

A base config file defines extension points where plugins inject their own configuration. Namespacing prevents collisions.

### 4a. devcontainer.json `customizations`

**Source:** [containers.dev/supporting](https://containers.dev/supporting) and [containers.dev/implementors/json_reference](https://containers.dev/implementors/json_reference/)

**This is the closest structural precedent to hop.json's `extensions` pattern.**

The `customizations` property is documented as:
> "Product specific properties, defined in supporting tools"

Each supporting tool claims a key under `customizations`:

```json
{
  "customizations": {
    "vscode": {
      "settings": { "editor.fontSize": 14 },
      "extensions": ["dbaeumer.vscode-eslint"]
    },
    "codespaces": {
      "repositories": {
        "my_org/my_repo": {
          "permissions": { "issues": "write" }
        }
      },
      "openFiles": ["README.md"]
    }
  }
}
```

**How tool keys are claimed:**
- Documented on the [supporting tools page](https://containers.dev/supporting)
- Each tool defines what properties go under its namespace
- VS Code, Visual Studio, IntelliJ IDEA, GitHub Codespaces, DevBox, etc. each have their own section
- Properties marked with 🏷️ can be stored in container image labels (metadata propagation)

**The core spec does NOT validate customization contents.** It defines the extension point (`customizations` as an open object) and lets tools own their sub-schemas.

### 4b. ESLint Flat Config (Plugin Composition)

**Source:** [eslint.org/docs/latest/extend/plugins](https://eslint.org/docs/latest/extend/plugins)

ESLint's modern flat config system treats plugins as JavaScript objects with well-defined exports:

```javascript
const plugin = {
  meta: {
    name: "eslint-plugin-example",
    version: "1.2.3",
    namespace: "example",  // prefix for rules
  },
  configs: {},   // Named configuration presets
  rules: {},     // Custom rule definitions
  processors: {}, // Code processors
};
export default plugin;
```

**Key design decisions:**
- **Namespace via meta.namespace:** Rules are referenced as `"example/dollar-sign"` — plugin prefix prevents collisions
- **Plugins are npm packages:** No registry needed beyond npm itself
- **Config arrays compose:** `eslint.config.js` exports an array; later entries override earlier ones
- **Plugins can export their own configs:** `extends: ["example/recommended"]` pulls in pre-packaged config
- **Publishing conventions:** Keywords `eslint`, `eslintplugin`, `eslint-plugin` required in `package.json`
- **Backwards compatibility:** Plugins can export both flat and legacy configs (`"flat/recommended"` vs `"recommended"`)

**Key insight:** Because config is a JavaScript file (not JSON), ESLint gets **programmatic composition** for free. Plugins export config objects; users spread them into arrays. This is more powerful than static JSON composition but requires a runtime.

### 4c. Prettier Plugins

**Source:** [prettier.io/docs/plugins](https://prettier.io/docs/plugins)

**How it works:**
- Plugins are npm packages with well-defined exports: `languages`, `parsers`, `printers`, `options`, `defaultOptions`
- **No registry** — Plugins are npm packages loaded via:
  - CLI: `prettier --write main.foo --plugin=prettier-plugin-foo`
  - API: `plugins: ["prettier-plugin-foo"]`
  - Config: `{ "plugins": ["prettier-plugin-foo"] }`
- Strings are passed to `import()` — any resolvable module path works

**Discovery via naming convention:**
- Official plugins use `@prettier/plugin-*` scope
- Community plugins use `prettier-plugin-*` convention
- The Prettier docs maintain a curated list of known plugins, but it's documentation, not a registry

**Two tiers without formal governance:**
- Official (`@prettier/*`): Maintained by Prettier team or adopted maintainers
- Community (`prettier-plugin-*`): Anyone can publish

### 4d. package.json (Organic Growth — Cautionary Tale)

**How it evolved:**
```json
{
  "name": "my-app",
  "eslintConfig": { ... },
  "prettier": { ... },
  "jest": { ... },
  "browserslist": ["> 0.2%"],
  "babel": { ... },
  "husky": { ... },
  "lint-staged": { ... }
}
```

Each tool claimed a top-level key. No formal registry. No governance. The result:
- `package.json` became bloated and hard to read
- Tools began preferring dedicated config files (`.prettierrc`, `eslint.config.js`, `jest.config.ts`)
- The npm spec for `package.json` itself only defines a subset; tool-specific keys are technically "extra"

**Lesson for hop.json:** Without governance, a shared config file can become a dumping ground. The devcontainer.json approach (explicit `customizations` namespace) is better than the package.json approach (arbitrary top-level keys).

### 4e. tsconfig.json (`extends`)

**How it works:**
- `"extends": "./base.tsconfig.json"` for local inheritance
- `"extends": "@tsconfig/node18/tsconfig.json"` for npm-published shared configs
- Single inheritance (one extends target per file)
- Extended config is overridden by local config

**The `@tsconfig/*` namespace on npm** provides shared configs without central governance — anyone can publish under `@tsconfig/` if they have npm access.

---

## Comparison Matrix

| Model | Example | Gov. Overhead | Discoverability | Version Compat | Adoption Friction | Scalability |
|-------|---------|:---:|:---:|:---:|:---:|:---:|
| **Central monorepo** | DefinitelyTyped | 🔴 Very High | 🟢 Excellent | 🟡 Moderate | 🟡 Moderate | 🔴 Bottleneck |
| **Central curated** | Docker Official | 🔴 Extreme | 🟢 Excellent | 🟢 Excellent | 🔴 Very High | 🔴 ~200 images |
| **Central service** | VS Code Marketplace | 🟡 Moderate | 🟢 Excellent | 🟢 Good | 🟡 Moderate | 🟢 Good |
| **Central catalog** | SchemaStore | 🟡 Moderate | 🟢 Excellent | 🟡 Moderate | 🟢 Low | 🟡 PR-gated |
| **Hybrid (central+taps)** | Homebrew | 🟡 Mixed | 🟢/🔴 Split | 🟢 Good | 🟡/🟢 Split | 🟢 Good |
| **Hybrid (thin index)** | Terraform Registry | 🟢 Low | 🟢 Excellent | 🟢 Excellent | 🟢 Low | 🟢 Excellent |
| **Hybrid (CRDs)** | Kubernetes | 🟢 Minimal | 🟡 Moderate | 🟡 Moderate | 🟢 Low | 🟢 Excellent |
| **Decentralized (OCI)** | DevContainer Features | 🟢 Minimal | 🟡 Moderate | 🟢 Good | 🟢 Very Low | 🟢 Excellent |
| **Decentralized (runtime)** | MCP Servers | 🟢 Near-zero | 🔴 Poor | 🟢 Good | 🟢 Low | 🟢 Excellent |
| **Decentralized (spec)** | OpenAPI | 🟢 Minimal | 🟡 Variable | 🟢 Good | 🟢 Low | 🟢 Excellent |
| **Schema composition** | devcontainer customizations | 🟢 Minimal | 🟡 Moderate | 🟡 Variable | 🟢 Very Low | 🟢 Good |
| **Plugin composition** | ESLint flat config | 🟢 Minimal | 🟡 npm search | 🟢 Good | 🟢 Low | 🟢 Good |
| **Naming convention** | Prettier plugins | 🟢 Minimal | 🟡 Convention | 🟢 Good | 🟢 Low | 🟢 Good |

---

## Recommendation for hop.json

### The Verdict: Decentralized Self-Declaration + Convention + Optional Community Index

**This is validated by overwhelming real-world precedent.** The modern trend across all ecosystems examined is toward self-declaration with optional discovery indexes. Even systems that started centralized (DefinitelyTyped) are encouraging migration to self-hosted (bundled types).

### Why Decentralized Fits

| Factor | Why it fits hop.json |
|--------|---------------------|
| **Stage** | Early ecosystem with few tools. Central registry overhead would exceed value. |
| **Pace** | Tools (Beads, Basic Memory, NTM) evolve at different rates. Central repo would bottleneck fast-movers. |
| **Ownership** | Who knows the correct Beads config schema? The Beads team. Not hop-spec maintainers. |
| **Precedent** | devcontainer.json, Terraform providers, MCP servers, ESLint plugins — all decentralized. |
| **Already built** | hop.json's `extensions` field with `additionalProperties: true` already supports this. |

### Why NOT Central Registry

| Risk | Evidence |
|------|----------|
| **Governance burden** | DefinitelyTyped requires Microsoft-sponsored bot infrastructure for 50k PRs/year. |
| **Contributor friction** | Docker Official Images: only ~200 exist because the bar is too high. |
| **Pace mismatch** | SchemaStore schemas often lag behind tool releases, causing false validation errors. |
| **The escape hatch always wins** | Homebrew needed taps. DT recommends bundled types. Docker has non-official images. Every central system builds an escape hatch — better to start decentralized. |

### Why NOT Pure Anarchy

The risk of pure decentralization is:
- **Key collisions:** Two tools claim `"analytics"` → solved by convention (use package name or reverse-domain)
- **Schema discovery:** Users don't know what extensions exist → solved by optional index
- **Quality variance:** Some extensions are well-documented, others aren't → solved by "featured" or "verified" badges, not gatekeeping
- **Bloat (package.json lesson):** → solved by explicit `extensions` namespace (like devcontainer.json `customizations`), not arbitrary top-level keys

### The Three-Phase Plan

**Phase 1 (Now): Pure Decentralized with Conventions**

hop.json already has the right primitive: the `extensions` field. The design mirrors `devcontainer.json`'s `customizations` exactly:

```
// devcontainer.json                    // hop.json
{                                       {
  "customizations": {                     "extensions": {
    "vscode": { ... },                      "beads": { ... },
    "codespaces": { ... },                  "basic-memory": { ... },
    "gitpod": { ... }                       "fireflies": { ... }
  }                                       }
}                                       }
```

**Conventions to document now:**
1. Extension key = tool's npm/PyPI package name or well-known slug (lowercase, hyphens) — mirrors Terraform's `terraform-provider-{NAME}` pattern
2. Each extension SHOULD include `"enabled": true/false` (already in schema)
3. Each extension MAY include `"$schema": "https://..."` for validation (already in schema)
4. Tools SHOULD publish a `hop-extension.schema.json` in their repo (like devcontainer features publish `devcontainer-feature.json`)
5. SchemaStore lesson: avoid `additionalProperties: false` in extension schemas — allow forward compatibility

**Phase 2 (10+ tools): Thin Community Index**

Add a lightweight index, modeled on Terraform Registry's approach but without the infrastructure:

```
hop-spec/
  registry/
    index.json          # Thin catalog
    extensions/
      beads.md          # Human-readable docs
      basic-memory.md
```

`index.json`:
```json
{
  "extensions": {
    "beads": {
      "name": "Beads Task Tracking",
      "repo": "https://github.com/org/beads",
      "schema_url": "https://beads-project.org/schema/v1/hop-extension.json",
      "scopes": ["project", "machine"],
      "description": "Lightweight task tracking with bead files"
    }
  }
}
```

This is NOT a code registry. It's a phone book. Tool authors submit a one-entry PR. No code review — just verify the link works and the key doesn't collide. (Like SchemaStore's path for "self-hosted/external" schemas.)

**Phase 3 (If ecosystem demands): Automated Discovery**

If adoption warrants it (like Terraform's CLI integration):
- `hop extensions search` CLI command
- Schema auto-fetch from published `$schema` URIs
- Editor autocomplete for extension keys (like SchemaStore provides for JSON files)
- Optional "verified" tier for extensions that pass a test suite

---

## Implementation Sketch

### What Tool Authors Do

A tool like Beads would:

**1. Create a schema file in their repo:**
```json
// beads/schemas/hop-extension.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://beads-project.org/schema/v1/hop-extension.json",
  "title": "Beads hop.json Extension",
  "description": "Configuration for Beads task tracking in hop.json",
  "type": "object",
  "properties": {
    "enabled": { "type": "boolean", "default": true },
    "prefix": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "workspace_path": { "type": "string" }
  },
  "required": ["prefix"],
  "additionalProperties": true
}
```

**2. Document the extension in their README:**
```markdown
## hop.json Integration

Add to your `hop.json` at project level:

{
  "projects": [{
    "name": "my-app",
    "extensions": {
      "beads": {
        "$schema": "https://beads-project.org/schema/v1/hop-extension.json",
        "enabled": true,
        "prefix": "app"
      }
    }
  }]
}
```

**3. Optionally submit to the index (a one-line PR to hop-spec)**

### What hop.json Spec Maintains

1. ✅ The `extensions` field definition (already done)
2. ✅ The `extensionEntry` base schema with `enabled` and `$schema` conventions (already done)
3. 📝 A naming convention doc: "Extension keys MUST be lowercase slugs. Use your package name."
4. 📝 An `EXTENSIONS.md` guide for tool authors (like devcontainers' feature-template README)
5. ⏳ An optional `registry/index.json` for discovery (Phase 2)

### What hop.json Spec Does NOT Maintain

- ❌ Individual extension schemas (owned by tool repos)
- ❌ Extension code or implementation
- ❌ Review of extension config shapes
- ❌ Approval gates for new extensions

---

## Appendix: Sources Consulted

| System | Primary Source URL | Content Used |
|--------|--------------------|--------------|
| DefinitelyTyped | `raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/README.md` | Contribution process, bot workflow, PR lifecycle, package structure |
| Homebrew Core | `docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request` | PR process, formula submission, audit requirements |
| Homebrew Taps | `docs.brew.sh/Taps` | Tap naming conventions, collision handling, `brew tap` semantics |
| Docker Official Images | `raw.githubusercontent.com/docker-library/official-images/master/README.md` | Review guidelines, maintainership, repeatability, security requirements |
| VS Code Marketplace | `code.visualstudio.com/api/working-with-extensions/publishing-extension` | Publisher creation, vsce CLI, automated review, PAT authentication |
| SchemaStore | `raw.githubusercontent.com/SchemaStore/schemastore/master/CONTRIBUTING.md` | Schema authoring best practices, catalog.json, self-hosted vs local schemas |
| DevContainer Features (Distribution) | `containers.dev/implementors/features-distribution/` | OCI distribution, packaging, versioning, collection metadata, local references |
| DevContainer Features (Reference) | `containers.dev/implementors/features/` | Feature metadata schema, options, customizations, lifecycle hooks |
| DevContainer JSON Reference | `containers.dev/implementors/json_reference/` | Full property reference including `customizations` and `features` objects |
| DevContainer Supporting Tools | `containers.dev/supporting` | `customizations` namespace usage by VS Code, Codespaces, IntelliJ, Gitpod |
| MCP Specification | `modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle` | Initialize handshake, capability negotiation, version negotiation |
| MCP Server Primitives | `modelcontextprotocol.io/specification/2025-03-26/server/` | Prompts, resources, tools — server-declared capabilities |
| Terraform Registry (Providers) | `developer.hashicorp.com/terraform/registry/providers` | Tier system, namespace conventions, registry integration |
| Terraform Registry (Publishing) | `developer.hashicorp.com/terraform/registry/providers/publishing` | GitHub release flow, manifest file, GPG signing, GitHub Actions |
| Kubernetes CRDs | `kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/` | CRD vs ConfigMap decision, declarative APIs, API aggregation |
| ESLint Plugin System | `eslint.org/docs/latest/extend/plugins` | Plugin object structure, namespace/meta, configs in plugins, flat config composition |
| ESLint Configuration | `eslint.org/docs/latest/use/configure/configuration-files` | Flat config arrays, extends, cascading, plugin registration |
| Prettier Plugins | `prettier.io/docs/plugins` | Plugin API (languages/parsers/printers/options), loading, official vs community |
| OpenAPI Generator | `openapi-generator.tech/docs/customization/` | Template customization, external config files, user-defined templates |
| JSON Schema Structuring | `json-schema.org/understanding-json-schema/structuring` | $id, $ref, base URI, schema identification, JSON Pointer |
| hop.json Schema | Local: `spec/hop-schema.json` | Current extensions definition, extensionEntry base schema |

---

*Research completed 2026-01-27. Based on analysis of primary documentation from each system listed above.*

---

## Addendum: Deep Technical Details (hopr-1kz supplemental research)

**Date**: 2026-01-27 (supplemental pass by HazyGlen)

This addendum provides deeper technical implementation details for each ecosystem, gathered from source documentation and code context analysis.

### A.1 DefinitelyTyped — Technical Publishing Flow

**Bundled types (preferred path)**:
Tool authors set the `types` field in `package.json`:
```json
{
  "name": "my-library",
  "main": "./lib/main.js",
  "types": "./lib/main.d.ts"
}
```

**`typesVersions` for multi-version support** (since TS 3.1):
```json
{
  "typesVersions": {
    ">=3.2": { "*": ["ts3.2/*"] },
    ">=3.1": { "*": ["ts3.1/*"] }
  }
}
```
This allows shipping different type definitions per TypeScript version — order-dependent matching.

**Key trade-off for HOP**: Bundled types eliminate version sync issues but mean each library release includes types. DefinitelyTyped's `@types/*` exists as a fallback when library authors don't bundle types. The equivalent for HOP would be: tool authors SHOULD bundle their `hop-extension.json` in their own package, with a community-maintained index as fallback.

### A.2 Terraform Registry — Manifest and Release Details

**`terraform-registry-manifest.json`**:
```json
{
  "version": 1,
  "metadata": {
    "protocol_versions": ["5.0"]
  }
}
```

**Release asset requirements** (manual builds):
- Zip archives: `terraform-provider-{NAME}_{VERSION}_{OS}_{ARCH}.zip`
- Binary: `terraform-provider-{NAME}_v{VERSION}` inside zip
- SHA256SUMS file covering all zips + manifest
- GPG detached signature of SHA256SUMS (binary, not ASCII-armored)
- Release must be finalized (not draft)

**GitHub Actions workflow** (preferred): Uses GoReleaser with GPG signing. The scaffolding repo (`hashicorp/terraform-provider-scaffolding-framework`) provides a complete CI template.

**Webhook-driven updates**: Publishing creates a GitHub webhook on the repo subscribed to `release` events. New releases automatically appear in the registry.

**Relevance to HOP**: The webhook + manifest pattern is elegant. If HOP ever builds a registry, watching npm publish events (via npm hooks or polling) for packages with a `hop-extension` keyword would be the equivalent.

### A.3 Kubernetes CRDs — Schema Validation Layers

CRDs support increasingly sophisticated validation:

**Level 1: OpenAPI v3 Schema** (basic types, enums, patterns):
```yaml
properties:
  engine:
    type: string
    enum: ["postgres", "mysql", "mongodb"]
  version:
    type: string
    pattern: '^\d+\.\d+(\.\d+)?$'
```

**Level 2: CEL Validation Rules** (K8s 1.25+, cross-field):
```yaml
x-kubernetes-validations:
  - rule: "self.engine == 'postgres' ? (self.version.startsWith('15') || self.version.startsWith('14')) : true"
    message: "PostgreSQL only supports versions 14.x and 15.x"
  - rule: "!self.highAvailability.enabled || self.highAvailability.replicas >= 2"
    message: "High availability requires at least 2 replicas"
```

**Level 3: Admission Webhooks** (arbitrary validation logic in external services)

**Multi-version with conversion webhooks**:
```yaml
versions:
  - name: v1alpha1
    served: true
    storage: false
    deprecated: true
    deprecationWarning: "Migrate to v1"
  - name: v1
    served: true
    storage: true
conversion:
  strategy: Webhook
  webhook:
    conversionReviewVersions: ["v1"]
```

**Relevance to HOP**: JSON Schema provides Level 1. HOP may eventually want Level 2 (cross-field validation) — consider `if/then/else` in JSON Schema draft-07+ as the equivalent of CEL rules.

### A.4 Dev Container Features — Distribution Deep Dive

**OCI artifact packaging**: Features are tarballs published as OCI artifacts (not Docker images). The artifact contains:
- `devcontainer-feature.json` (metadata)
- `install.sh` (entry point)
- Additional files as needed

**Collection metadata** (`devcontainer-collection.json`):
Generated automatically during publish. Contains metadata for all features in a collection, enabling batch discovery.

**Dependency management**:
- `dependsOn` — hard dependencies, MUST be installed first. Supports options:
  ```json
  {
    "dependsOn": {
      "foo:1": { "flag": true },
      "bar:1.2.3": {}
    }
  }
  ```
- `installsAfter` — soft ordering hints. Same behavior as `dependsOn` except not automatically pulled in.
- User override: `overrideFeatureInstallOrder` in `devcontainer.json`

**Options schema**:
```json
{
  "options": {
    "version": {
      "type": "string",
      "proposals": ["latest", "1.21", "1.20"],
      "default": "latest",
      "description": "Go version to install"
    }
  }
}
```
Options become ALL_CAPS environment variables in `install.sh`.

**Relevance to HOP**: The `dependsOn` (hard) vs `installsAfter` (soft) distinction is directly applicable. Extension specs in HOP could declare dependencies on other extensions. The `options` pattern with `proposals` (suggested values, not enforced) vs `enum` (strict values) is a useful UX distinction.

### A.5 ESLint Plugins — Flat Config Technical Details

**Plugin object structure** (ESLint 9+):
```js
export default {
  meta: {
    name: "eslint-plugin-mycompany",
    version: "2.0.0"
  },
  rules: {
    "no-foo": { create(context) { /* ... */ } },
    "prefer-bar": { create(context) { /* ... */ } }
  },
  configs: {
    recommended: [
      {
        plugins: { /* self-reference */ },
        rules: {
          "mycompany/no-foo": "error",
          "mycompany/prefer-bar": "warn"
        }
      }
    ]
  }
};
```

**Shareable config publishing** (eslint.org/docs/latest/extend/shareable-configs):
- Package name: `eslint-config-{name}` or `@scope/eslint-config`
- Export: array of config objects (or single object)
- Keywords: `eslint`, `eslintconfig` in package.json
- Peer dependency: `"eslint": ">= 9"`
- Consuming: `import { defineConfig } from "eslint/config"` with `extends`

**Monorepo pattern** (from ESLint discussion #16960):
Single `eslint.config.js` at root with `files` globs per package:
```js
export default [
  { files: ["packages/api/**/*.js"], rules: { "semi": "error" } },
  { files: ["packages/frontend/**/*.js"], rules: { "no-undef": "error" } }
];
```

**Relevance to HOP**: The plugin self-referencing its own recommended config is elegant — extension specs could similarly bundle "recommended" hop.json fragments. The monorepo pattern with file-glob scoping maps directly to HOP's per-project overrides.

### A.6 Cross-Ecosystem Synthesis

**Publishing friction comparison**:

| Ecosystem | Steps to Publish | Time to Availability |
|-----------|-----------------|---------------------|
| DefinitelyTyped | Fork, PR, CI, Review, Bot merge, Auto-publish | 1-14 days |
| Terraform | Create repo, Tag release, Sign-in to registry, Webhook | ~1 hour first time, minutes thereafter |
| K8s CRDs | Create YAML, kubectl apply (no registry) | Immediate (per-cluster) |
| Dev Container Features | Create repo, CI packages, Push to OCI | Minutes (with template) |
| ESLint | npm publish | Immediate |

**Discovery mechanism comparison**:

| Ecosystem | Primary Discovery | Deterministic? | Search Quality |
|-----------|------------------|---------------|----------------|
| DefinitelyTyped | `@types/{name}` on npm | Yes (naming) | Excellent |
| Terraform | registry.terraform.io | Yes (namespace/name) | Excellent |
| K8s CRDs | ArtifactHub, OperatorHub | No | Moderate |
| Dev Container Features | containers.dev index | Partial | Moderate |
| ESLint | npm search + awesome-eslint | No | Poor |

**HOP's sweet spot**: Deterministic naming (`hop-config-{tool}` or `@hop/{tool}`) + npm as distribution + lightweight index page = best of Terraform's discoverability with ESLint's zero-friction publishing.

### A.7 Additional Sources (Addendum)

1. TypeScript Declaration Publishing: https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html
2. Terraform Provider Publishing: https://developer.hashicorp.com/terraform/registry/providers/publishing
3. Terraform Module Publishing: https://developer.hashicorp.com/terraform/registry/modules/publish
4. Kubernetes CRD Documentation: https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/
5. Dev Container Features Specification: https://containers.dev/implementors/features/
6. Dev Container Features Distribution: https://containers.dev/implementors/features-distribution/
7. ESLint Shareable Configs: https://eslint.org/docs/latest/extend/shareable-configs
8. ESLint Flat Config in Monorepos: https://github.com/eslint/eslint/discussions/16960
