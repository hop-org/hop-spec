# HarnessOps vs The Alternatives

How does HarnessOps compare to existing tools? This page explains what each tool does, where they overlap, and why HarnessOps exists alongside them.

---

## TL;DR

| | HarnessOps | devcontainer.json | mise | chezmoi |
|---|---|---|---|---|
| **What it is** | Machine environment spec | Container dev environment | Tool version manager | Dotfile manager |
| **Config format** | JSON (`hop.json`) | JSON | TOML (`.mise.toml`) | Templates + YAML |
| **Scope** | Whole machine | Single container | Tool runtimes | Dotfiles across machines |
| **AI/MCP aware** | Yes (core feature) | No | No | No |
| **Multi-machine** | Yes (same projects, different paths) | No (per-container) | No (per-directory) | Yes (templates) |
| **Project registry** | Yes | No | No | No |
| **Account management** | Yes (GitHub, auth methods) | No | No | No |
| **Secret references** | Yes (BWS integration) | Yes (secrets in features) | No | Yes (secret managers) |
| **Requires runtime** | No (static JSON) | Docker/Podman | mise binary | chezmoi binary |

---

## devcontainer.json

**What it does**: Defines a containerized development environment — base image, features, extensions, settings, port forwarding. Used by VS Code Dev Containers, GitHub Codespaces, and other tools.

**Where it overlaps with HarnessOps**:
- JSON-based declarative configuration
- Development environment setup
- Extension/customization system
- Feature-based progressive enhancement

**Where HarnessOps differs**:

| Concern | devcontainer.json | HarnessOps |
|---------|-------------------|------------|
| Target | One container | Any machine (bare metal, VM, container, WSL) |
| Projects | Not tracked | Full project registry with git config |
| Machine identity | Implicit | Explicit (`machine.id`, `machine.name`) |
| AI tooling | Not addressed | MCP server config, agent roots, CLI activity logs |
| Accounts | Not addressed | GitHub accounts with auth methods |
| Runtime dependency | Docker/Podman required | None (static JSON file) |
| Bundles/workflows | Not addressed | Project grouping and workflow switching |

**Use together**: HarnessOps describes the machine. A devcontainer.json can exist inside a project referenced by HarnessOps. They complement each other — HarnessOps is the outer layer, devcontainer is the inner layer.

**HarnessOps borrowed from devcontainer**: The `extensions` namespace pattern. Like devcontainer's `customizations` object, HarnessOps lets each tool own its own configuration block without polluting the core schema.

---

## mise (formerly rtx)

**What it does**: Manages tool versions (Node, Python, Go, etc.) per directory. Replacement for asdf, nvm, pyenv, and similar tools. Reads `.mise.toml` or `.tool-versions`.

**Where it overlaps with HarnessOps**:
- Describes what tools a project needs
- Per-directory configuration
- Developer environment consistency

**Where HarnessOps differs**:

| Concern | mise | HarnessOps |
|---------|------|------------|
| Scope | Tool runtimes per directory | Entire machine description |
| Tool installation | Yes (downloads and installs) | No (declarative only) |
| Projects | Per-directory, implicit | Explicit registry with metadata |
| Machine identity | Not addressed | Core feature |
| Accounts | Not addressed | GitHub accounts, auth methods |
| AI/MCP config | Not addressed | Core feature |
| Config format | TOML | JSON (with JSON Schema) |
| Action model | Active (installs tools) | Passive (describes state) |

**Use together**: mise manages what tool versions are installed. HarnessOps describes where projects are and how accounts/agents are configured. A project in `hop.json` might have a `.mise.toml` in its directory — they operate at different layers.

**Key distinction**: mise is a **tool runtime manager** — it actively installs and switches tool versions. HarnessOps is a **machine descriptor** — it passively describes what exists. mise changes your environment; HarnessOps documents it.

---

## chezmoi

**What it does**: Manages dotfiles across multiple machines using templates, secret manager integration, and a Git-based source of truth. Handles machine-specific variations via templates and host-specific config.

**Where it overlaps with HarnessOps**:
- Multi-machine awareness
- Machine-specific configuration
- Secret manager integration
- Git-based synchronization

**Where HarnessOps differs**:

| Concern | chezmoi | HarnessOps |
|---------|---------|------------|
| Manages | Dotfiles (any config file) | Machine environment description |
| Sync model | Template + apply (modifies files) | Static JSON (read-only reference) |
| Machine identity | Hostname/OS-based templates | Explicit `machine.id` and metadata |
| Projects | Not tracked | Full project registry |
| AI/MCP config | Not addressed | Core feature |
| Accounts | Not addressed | GitHub accounts, auth methods |
| Action model | Active (applies templates to files) | Passive (tools read it) |
| Complexity | Template language, scripting | Plain JSON, JSON Schema |

**Use together**: chezmoi can manage `hop.json` as one of the dotfiles it syncs across machines. Each machine gets its own `hop.json` with machine-specific paths, but chezmoi templates could generate them from a shared base. Alternatively, HarnessOps and chezmoi can coexist independently — chezmoi for dotfiles, HarnessOps for the machine-level AI dev environment.

**Key distinction**: chezmoi is a **file synchronization tool** — it templates and deploys dotfiles. HarnessOps is a **machine-level registry** — it describes the environment so tools and agents can discover projects, accounts, and configuration. chezmoi moves files; HarnessOps provides context.

---

## Why Not Just Use One of These?

None of these tools solve the problem HarnessOps addresses:

> **How does an AI agent know what machine it's on, where projects live, and which accounts to use?**

- **devcontainer.json** assumes a container. Most AI dev happens on bare metal, VPS, or WSL.
- **mise** manages tool versions. It doesn't know about your GitHub accounts or MCP servers.
- **chezmoi** syncs files. It doesn't provide a queryable registry of projects and machine identity.

HarnessOps fills the gap between these tools. It's the **environment context layer** that AI agents and development tools can query to understand the machine they're running on.

---

## Decision Guide

**Use devcontainer.json** when you want a reproducible, containerized dev environment for a single project.

**Use mise** when you need to manage tool versions (Node 20, Python 3.12, Go 1.22) per project.

**Use chezmoi** when you need to sync dotfiles and shell configs across machines.

**Use HarnessOps** when you need AI agents and tools to understand your machine: what projects exist, where they are, which GitHub accounts to use, how bundles are organized, and what extensions are configured.

**Use all of them together** — they operate at different layers and complement each other.

---

## Comparison with Other Tools

| Tool | Layer | Relationship |
|------|-------|-------------|
| **Ansible/Puppet** | Provisioning | HarnessOps describes desired state; Ansible achieves it |
| **direnv** | Per-directory env vars | Complementary; direnv sets vars, HarnessOps provides context |
| **Nix/devenv** | Reproducible environments | Heavier; HarnessOps is lighter and JSON-native |
| **AGENTS.md** | Agent instructions | HarnessOps = machine config; AGENTS.md = agent behavior |
| **MCP** | AI tool protocol | HarnessOps configures MCP servers; MCP is the transport |
| **.tool-versions** | Tool version pinning | HarnessOps complements; doesn't replace |

---

*See the [full specification](../spec/hop-schema.json) and [getting started guide](getting-started.md).*
