# @hop-org/hop-spec-core

Core library for [HarnessOps](../../README.md) — hop.json parser, validator, discovery, and TypeScript types.

## Install

```bash
npm install @hop-org/hop-spec-core
```

## Usage

```typescript
import { discoverAndLoad, collectSystems, type HopConfig } from "@hop-org/hop-spec-core";

// Discover and load hop.json
const result = discoverAndLoad();
if (result) {
  const { config, path } = result;
  console.log(`Loaded ${path}: machine=${config.machine.name}`);
}

// Collect system groupings
const systems = collectSystems(config);
for (const [name, data] of systems) {
  console.log(`${name}: ${data.projects.length} projects`);
}
```

## Exports

- `discoverAndLoad()` — Find and parse hop.json
- `discoverHopPath()` — Find hop.json without loading
- `setConfigPath()` — Pin hop.json location via `~/.hop/settings.json`
- `collectSystems()` — Group projects and infra repos by system
- `normalizeInfraRepo()` — Normalize string or object infra repo entries
- `infraRepoName()` — Extract name from an infra repo entry
- `ensureHopDir()` — Ensure `~/.hop/` directory exists
- `HOP_DEFAULT_PATH` — Default hop.json path (`~/.hop/hop.json`)
- Type exports: `HopConfig`, `Machine`, `Project`, `Bundle`, `InfraRepoEntry`

## License

MIT
