# HarnessOps Validation Rules and Error Messages

**Version**: 0.1.0

---

## Purpose

This document defines validation rules that go **beyond JSON Schema** structural validation. These rules ensure HarnessOps configurations are not only syntactically correct but semantically valid and usable.

---

## Validation Categories

1. **Schema Validation** - JSON Schema compliance (prerequisite)
2. **Semantic Validation** - Cross-field consistency and logic
3. **Environment Validation** - Runtime checks (paths, tools, permissions)
4. **Reference Validation** - Cross-object references resolve correctly

---

## 1. Schema Validation (Prerequisite)

Schema validation MUST pass before semantic validation runs.

### Error Messages

| Error | Message | Suggestion |
|-------|---------|------------|
| Missing `schema_version` | `Missing required field: schema_version` | Add `"schema_version": "0.1.0"` to your HarnessOps file |
| Missing `machine` | `Missing required field: machine` | Add a `machine` object with `id` and `name` |
| Missing `machine.id` | `Missing required field: machine.id` | Add a unique identifier for this machine |
| Missing `machine.name` | `Missing required field: machine.name` | Add a human-readable name for this machine |
| Invalid `schema_version` format | `Invalid schema_version format: "{value}". Expected semver (e.g., "0.1.0")` | Use semver format: MAJOR.MINOR or MAJOR.MINOR.PATCH |
| Invalid `machine.id` format | `Invalid machine.id: "{value}". Must be lowercase alphanumeric with hyphens (slug format)` | Use only a-z, 0-9, and hyphens (e.g., "my-machine") |

---

## 2. Semantic Validation Rules

### 2.1 Machine Rules

#### RULE: machine.id uniqueness (cross-registry)

```
IF syncing with other HarnessOps registries
THEN machine.id MUST be globally unique
```

**Error**: `Duplicate machine.id detected: "{id}" is already registered in sync network`
**Suggestion**: Choose a unique machine identifier (consider adding a random suffix or organization prefix)

#### RULE: machine.type valid enum

```
IF machine.type is specified
THEN machine.type MUST be one of: cloud-vps, cloud-vm, local-desktop, local-laptop, container, wsl
```

**Warning** (not error): `Unknown machine.type: "{type}". Consider using standard types for better tooling support: cloud-vps, cloud-vm, local-desktop, local-laptop, container, wsl`

---

### 2.2 Project Rules

#### RULE: project.name uniqueness

```
FOREACH project IN projects
  project.name MUST be unique within the projects array
```

**Error**: `Duplicate project name: "{name}" appears multiple times in projects array`
**Suggestion**: Each project must have a unique name within this HarnessOps file

#### RULE: project.path uniqueness

```
FOREACH project IN projects WHERE project.path IS NOT NULL
  project.path SHOULD be unique
```

**Warning**: `Duplicate project path: "{path}" is referenced by multiple projects: [{names}]`
**Suggestion**: If intentional (e.g., branch checkouts), consider using `branch_checkouts` instead

#### RULE: project.account_override exists

```
IF project.account_override IS NOT NULL
THEN account with username=project.account_override MUST exist in accounts.github
```

**Error**: `Invalid account_override: "{username}" not found in accounts.github`
**Suggestion**: Add this account to accounts.github or remove the account_override

---

### 2.3 Account Rules

#### RULE: single default account per service

```
FOREACH service IN accounts
  AT MOST ONE account WHERE default=true
```

**Error**: `Multiple default accounts for {service}: [{usernames}]. Only one default allowed.`
**Suggestion**: Set `default: true` on only one account per service

#### RULE: pat_bws_id requires https-pat auth_method

```
IF account.pat_bws_id IS NOT NULL
THEN account.auth_method SHOULD be "https-pat"
```

**Warning**: `Account "{username}" has pat_bws_id but auth_method is "{method}" (not https-pat)`
**Suggestion**: Set auth_method to "https-pat" if using PAT authentication

---

### 2.4 Bundle Rules

#### RULE: bundle.id uniqueness

```
FOREACH bundle IN bundles
  bundle.id MUST be unique
```

**Error**: `Duplicate bundle id: "{id}" appears multiple times`
**Suggestion**: Each bundle must have a unique identifier

#### RULE: bundle.projects reference valid projects

```
FOREACH bundle IN bundles
  FOREACH project_name IN bundle.projects
    project with name=project_name MUST exist in projects array
```

**Error**: `Bundle "{bundle_id}" references unknown project: "{project_name}"`
**Suggestion**: Ensure all projects in bundle exist in the projects array, or add the missing project

#### RULE: bundle.primary_project in projects list

```
IF bundle.primary_project IS NOT NULL
THEN bundle.primary_project MUST be in bundle.projects
```

**Error**: `Bundle "{bundle_id}" primary_project "{primary}" is not in its projects list`
**Suggestion**: Either add "{primary}" to the bundle's projects array, or choose a different primary_project

---

### 2.5 Cross-Reference Rules

#### RULE: cross_project.home_project exists

```
IF cross_project.home_project IS NOT NULL
THEN project with name=cross_project.home_project SHOULD exist in projects
```

**Warning**: `cross_project.home_project "{name}" not found in projects array`
**Suggestion**: Add the home project to the projects array, or update the reference

---

### 2.6 Extension Rules

Extensions are opaque to the core validator — tool authors define their own validation. However, some structural conventions can be checked:

#### RULE: extension key format

```
FOREACH key IN extensions (machine-scoped or project-scoped)
  key MUST match pattern: ^[a-z0-9][a-z0-9_-]*[a-z0-9]$ or ^[a-z0-9]$
```

**Error**: `Invalid extension key: "{key}". Must be a lowercase slug (a-z, 0-9, hyphens, underscores)`
**Suggestion**: Use lowercase slugs like "beads", "basic-memory", "cli-activity-logs"

#### RULE: extension beads prefix uniqueness (convention)

```
FOREACH project IN projects WHERE project.extensions.beads.prefix IS NOT NULL
  project.extensions.beads.prefix SHOULD be unique across projects
```

**Warning**: `Duplicate BEADS prefix: "{prefix}" is used by multiple projects: [{names}]. This may cause ID collisions.`
**Suggestion**: Use unique prefixes for each project's BEADS issues

---

## 3. Environment Validation Rules

These rules require runtime checks and may be skipped in strict schema-only validation.

### 3.1 Path Existence

#### RULE: machine.agent_root exists

```
IF machine.agent_root IS NOT NULL
THEN path machine.agent_root MUST exist and be a directory
```

**Error**: `machine.agent_root path does not exist: "{path}"`
**Suggestion**: Create the directory or update agent_root to an existing path

#### RULE: project.path exists

```
FOREACH project IN projects WHERE project.path IS NOT NULL
  path project.path SHOULD exist and be a directory
```

**Warning**: `Project "{name}" path does not exist: "{path}"`
**Suggestion**: Create the directory or update the project path

### 3.2 Git Repository Validation

#### RULE: project with git config has .git directory

```
FOREACH project IN projects WHERE project.git IS NOT NULL
  IF project.path IS NOT NULL
  THEN {project.path}/.git SHOULD exist
```

**Warning**: `Project "{name}" has git config but no .git directory at "{path}"`
**Suggestion**: Initialize git repository or remove git config from project

---

## 4. Validation Severity Levels

| Level | Behavior | Use Case |
|-------|----------|----------|
| **ERROR** | Validation fails, HarnessOps unusable | Required fields missing, references broken |
| **WARNING** | Validation passes with warnings | Non-critical issues, best practice violations |
| **INFO** | Informational, always passes | Network checks, optional improvements |

### Recommended Validation Modes

| Mode | Errors | Warnings | Info | Use Case |
|------|--------|----------|------|----------|
| **strict** | Fail | Fail | Pass | CI/CD validation |
| **normal** | Fail | Report | Pass | Development |
| **permissive** | Fail | Pass | Pass | Initial setup |
| **schema-only** | Fail | Skip | Skip | Quick syntax check |

---

## 5. Validation Implementation Notes

### Validation Order

1. JSON syntax check (can file be parsed?)
2. Schema validation (`$schema` reference)
3. Required field checks
4. Semantic validation (cross-field rules)
5. Reference validation (bundle -> project, account_override -> account)
6. Environment validation (path checks) - optional

### Collecting Errors

Validators SHOULD collect all errors/warnings before reporting, rather than failing on first error.

```json
{
  "valid": false,
  "errors": [
    {
      "path": "/machine/id",
      "rule": "required",
      "message": "Missing required field: machine.id",
      "suggestion": "Add a unique identifier for this machine"
    }
  ],
  "warnings": [
    {
      "path": "/projects/1/path",
      "rule": "path_exists",
      "message": "Project 'test' path does not exist: '/path/to/test'",
      "suggestion": "Create the directory or update the project path"
    }
  ]
}
```

---

## 6. Quick Reference: All Rules

### Required Field Rules (ERROR)

| Rule | Path | Message |
|------|------|---------|
| `schema_version.required` | `/` | Missing required field: schema_version |
| `machine.required` | `/` | Missing required field: machine |
| `machine.id.required` | `/machine` | Missing required field: machine.id |
| `machine.name.required` | `/machine` | Missing required field: machine.name |
| `project.name.required` | `/projects[*]` | Missing required field: name in project |
| `bundle.id.required` | `/bundles[*]` | Missing required field: id in bundle |
| `bundle.name.required` | `/bundles[*]` | Missing required field: name in bundle |
| `bundle.projects.required` | `/bundles[*]` | Missing required field: projects in bundle |

### Semantic Rules (ERROR)

| Rule | Path | Message |
|------|------|---------|
| `project.name.unique` | `/projects[*]/name` | Duplicate project name |
| `bundle.id.unique` | `/bundles[*]/id` | Duplicate bundle id |
| `bundle.projects.valid` | `/bundles[*]/projects[*]` | Bundle references unknown project |
| `bundle.primary.in_projects` | `/bundles[*]/primary_project` | Primary project not in bundle |
| `account_override.exists` | `/projects[*]/account_override` | Invalid account_override |
| `default_account.single` | `/accounts/*[*]/default` | Multiple default accounts |
| `extension.key.format` | `/extensions/*`, `/projects[*]/extensions/*` | Invalid extension key |

### Semantic Rules (WARNING)

| Rule | Path | Message |
|------|------|---------|
| `beads.prefix.unique` | `/projects[*]/extensions/beads/prefix` | Duplicate BEADS prefix |
| `project.path.unique` | `/projects[*]/path` | Duplicate project path |
| `cross_project.home.exists` | `/cross_project/home_project` | Home project not found |
| `pat_bws_id.auth_method` | `/accounts/github[*]` | PAT ID with wrong auth method |

### Environment Rules (WARNING/INFO)

| Rule | Path | Message |
|------|------|---------|
| `agent_root.exists` | `/machine/agent_root` | Path does not exist |
| `project.path.exists` | `/projects[*]/path` | Path does not exist |
| `git.repo.exists` | `/projects[*]/path/.git` | No .git directory |

---

## 7. Extension Validation Note

The core HarnessOps validator only checks extension key format and the structural `extensionEntry` requirements (`$schema` must be a URI if present, `enabled` must be boolean if present). All other extension validation is the responsibility of the tool that owns the extension.

Tool authors are encouraged to:
1. Publish a JSON Schema for their extension (referenced via the `$schema` field in their extension entry)
2. Provide their own validator that runs after core HarnessOps validation
3. Follow the `enabled` flag convention for easy toggling

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-23 | Initial validation rules specification |
| 0.1.0 | 2026-01-27 | Refactored for extensions namespace: updated paths, removed tool-specific rules, added extension validation |
