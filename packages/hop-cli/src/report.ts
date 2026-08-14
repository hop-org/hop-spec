/**
 * hop report — render the active hop.json as a readable HTML walkthrough.
 *
 * The point is orientation, not editing. `hop projects`, `hop infra`, and
 * `hop audit` each answer one question well, but nobody reading them in
 * sequence gets a picture of what the machine actually looks like or what is
 * missing from it. This command lays the whole configuration out in one page,
 * section by section, with a health panel up top listing what is absent,
 * unregistered, or contradicted by the filesystem.
 *
 * Output is a single self-contained file: styles and scripts are inlined, so it
 * opens offline and survives being emailed or dropped in a shared drive.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  Bundle,
  GitHubAccount,
  HopConfig,
  InfraRepoEntry,
  Project,
} from "@hop-org/hop-spec-core";
import { HOP_DIR, ensureHopDir, infraRepoName, normalizeInfraRepo } from "@hop-org/hop-spec-core";
import { computeAudit } from "./audit.js";
import { observeHarness } from "./harness.js";
import { FOUNDATION_CSS, FOUNDATION_JS } from "./assets.generated.js";

/** Severity ordering drives both sort position and colour. */
type Severity = "error" | "warn" | "info";

interface Finding {
  severity: Severity;
  /** Which section of hop.json the finding belongs to. */
  area: string;
  title: string;
  /** Why this matters — written for someone who did not author the config. */
  detail: string;
  /** Concrete next step, when there is an unambiguous one. */
  remedy?: string;
}

export interface ReportOptions {
  /** Destination path; defaults to report.html inside the runtime hop dir. */
  out?: string;
  /** Include the stray scan, which walks outside the managed directories. */
  scan?: boolean;
}

/**
 * Default output location: the runtime hop directory, never the working
 * directory and never the source checkout. The repo is software — it holds the
 * generator, not its output — and dropping a report into whatever directory the
 * user happened to be standing in makes the artifact hard to find twice.
 */
function defaultOutPath(): string {
  return join(HOP_DIR, "report.html");
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Escape text for interpolation into element content or a quoted attribute. */
function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render a value, or a muted placeholder when it is absent. */
function orDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return `<span class="hop-dash">—</span>`;
  }
  return esc(value);
}

function code(value: unknown): string {
  return `<code>${esc(value)}</code>`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Build a table, or an empty-state note when there are no rows.
 * `empty` explains what the absence means rather than just saying "no data".
 */
function table(headers: string[], rows: string[][], empty: string): string {
  if (rows.length === 0) {
    return `<p class="hop-empty">${empty}</p>`;
  }
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("\n      ");
  return `<div class="hop-table-wrap"><table>
    <thead><tr>${head}</tr></thead>
    <tbody>
      ${body}
    </tbody>
  </table></div>`;
}

function badge(text: string, kind: "good" | "warn" | "bad" | "info" | "dim"): string {
  return `<span class="hop-badge hop-badge-${kind}">${esc(text)}</span>`;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Walk the config looking for gaps a reader should react to.
 *
 * Two classes of finding are deliberately kept apart. Contradictions — a
 * registered path that does not exist, a git repo sitting unregistered inside a
 * managed directory — are errors or warnings because something is wrong. Absent
 * optional blocks are only ever `info`: plenty of machines legitimately have no
 * bundles or services, and flagging those as problems trains people to ignore
 * the panel.
 */
function analyze(config: HopConfig, scan: boolean): Finding[] {
  const findings: Finding[] = [];
  const audit = computeAudit(config, { scan });
  const projects = config.projects ?? [];

  // --- Machine ---
  if (!config.machine?.agent_root) {
    findings.push({
      severity: "warn",
      area: "machine",
      title: "No agent_root set",
      detail:
        "Agent tooling uses agent_root as the default place to look for work, and hop audit treats it as a managed directory. Without it, the audit has nothing to reconcile against.",
      remedy: "Set machine.agent_root to your development root.",
    });
  } else if (!existsSync(config.machine.agent_root)) {
    findings.push({
      severity: "error",
      area: "machine",
      title: "agent_root does not exist on disk",
      detail: `hop.json points at ${config.machine.agent_root}, but there is no directory there. Every path resolved relative to it will fail.`,
      remedy: "Correct machine.agent_root, or create the directory.",
    });
  }

  // --- Projects ---
  for (const p of projects) {
    if (!p.path) {
      findings.push({
        severity: "warn",
        area: "projects",
        title: `Project "${p.name}" has no path`,
        detail:
          "Name-to-path resolution is the most common reason tools consult hop.json. A project without a path cannot be resolved by hop path.",
        remedy: `Add a path to the "${p.name}" entry.`,
      });
    }
    if (!p.git?.default_branch) {
      findings.push({
        severity: "info",
        area: "projects",
        title: `Project "${p.name}" has no default_branch`,
        detail:
          "Consumers fall back to \"main\" when default_branch is absent. That is usually right, but it is an assumption rather than a statement, and it is wrong for any repo that has moved on.",
      });
    }
  }

  for (const s of audit.stale) {
    findings.push({
      severity: "error",
      area: "projects",
      title: `Registered project "${s.name}" is missing from disk`,
      detail: `hop.json lists ${s.path}, but nothing exists there. The entry is stale — the repo was moved, renamed, or never cloned on this machine.`,
      remedy: `Remove the "${s.name}" entry, or clone the repo to that path.`,
    });
  }

  const gitOrphans = audit.orphans.filter((o) => o.has_git);
  for (const o of gitOrphans) {
    findings.push({
      severity: "warn",
      area: "projects",
      title: `Unregistered repository "${o.name}"`,
      detail: `${o.path} is a git repository inside a managed directory, but no project entry claims it. Tools that enumerate projects from hop.json will not see it.`,
      remedy: `Add "${o.name}" to projects, or move it out of the managed directory.`,
    });
  }

  const plainOrphans = audit.orphans.filter((o) => !o.has_git);
  if (plainOrphans.length > 0) {
    findings.push({
      severity: "info",
      area: "projects",
      title: `${plainOrphans.length} unregistered non-git ${
        plainOrphans.length === 1 ? "directory" : "directories"
      }`,
      detail: `${plainOrphans
        .map((o) => o.name)
        .join(", ")} sit inside a managed directory without being registered. Scratch space and notes folders routinely live here, so this is usually expected.`,
    });
  }

  for (const s of audit.strays) {
    findings.push({
      severity: "info",
      area: "projects",
      title: `Repository "${s.name}" outside managed directories`,
      detail: `${s.path} is a git repository that hop.json does not describe and that lives outside any managed directory.`,
    });
  }

  // --- Infra repos ---
  const infra = config.infra_repos;
  if (infra) {
    if (!infra.path) {
      // The schema tolerates unknown keys, so a legacy or hand-written key name
      // validates cleanly while silently disabling path resolution. Name the
      // offending key rather than reporting a generic absence.
      const legacyKey = ["root", "root_path", "base", "dir"].find(
        (k) => typeof (infra as Record<string, unknown>)[k] === "string"
      );
      findings.push({
        severity: "error",
        area: "infra_repos",
        title: legacyKey
          ? `infra_repos uses "${legacyKey}" instead of "path"`
          : "infra_repos has no path",
        detail: legacyKey
          ? `The spec field is infra_repos.path, but this config sets "${legacyKey}". Unknown keys are allowed by the schema, so the file validates while hop infra reports "(not set)" and no infra repo path resolves.`
          : "Without infra_repos.path, repo entries cannot be resolved to directories and hop infra reports no location.",
        remedy: legacyKey
          ? `Rename "${legacyKey}" to "path".`
          : "Set infra_repos.path to the directory holding the clones.",
      });
    } else {
      for (const entry of infra.repos ?? []) {
        const name = infraRepoName(entry);
        const repoPath =
          typeof entry !== "string" && entry.path
            ? entry.path
            : join(infra.path, name);
        if (!existsSync(repoPath)) {
          findings.push({
            severity: "warn",
            area: "infra_repos",
            title: `Infra repo "${name}" is not cloned`,
            detail: `Listed in hop.json but absent at ${repoPath}.`,
            remedy: `Clone it, or drop the entry.`,
          });
        }
      }
    }
  }

  // --- Optional blocks, reported as absence rather than fault ---
  if ((config.bundles ?? []).length === 0) {
    findings.push({
      severity: "info",
      area: "bundles",
      title: "No bundles defined",
      detail:
        "Bundles group projects that get worked on together and give session tooling a default focus. Without them, every project is equally in scope.",
    });
  }
  if (Object.keys(config.services ?? {}).length === 0) {
    findings.push({
      severity: "info",
      area: "services",
      title: "No services defined",
      detail:
        "Services record live endpoints agents discover at runtime. Absent here, so anything expecting one will have to be told where to look.",
    });
  }
  if (!config.cross_project) {
    findings.push({
      severity: "info",
      area: "cross_project",
      title: "No cross_project block",
      detail:
        "cross_project names a hub project and a shared artifacts directory. Tools that write cross-repo output have no agreed destination without it.",
    });
  }

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderHealth(findings: Finding[]): string {
  const counts = {
    error: findings.filter((f) => f.severity === "error").length,
    warn: findings.filter((f) => f.severity === "warn").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  if (findings.length === 0) {
    return `<section>
    <h2 id="health">Health</h2>
    <div class="callout good"><strong>All clear.</strong> Every registered path exists, nothing unregistered was found in the managed directories, and no optional block is missing.</div>
  </section>`;
  }

  const label: Record<Severity, string> = {
    error: "Broken",
    warn: "Needs attention",
    info: "Worth knowing",
  };

  const items = findings
    .map(
      (f) => `<li class="hop-finding hop-finding-${f.severity}">
        <div class="hop-finding-head">
          ${badge(label[f.severity], f.severity === "error" ? "bad" : f.severity === "warn" ? "warn" : "info")}
          <span class="hop-finding-area">${esc(f.area)}</span>
          <span class="hop-finding-title">${esc(f.title)}</span>
        </div>
        <p class="hop-finding-detail">${esc(f.detail)}</p>
        ${f.remedy ? `<p class="hop-finding-remedy"><strong>Fix:</strong> ${esc(f.remedy)}</p>` : ""}
      </li>`
    )
    .join("\n      ");

  return `<section>
    <h2 id="health">Health</h2>
    <p>
      ${counts.error} broken, ${counts.warn} needing attention, ${counts.info} worth knowing.
      Broken items contradict the filesystem; the rest are gaps you may or may not want to fill.
    </p>
    <ul class="hop-findings">
      ${items}
    </ul>
  </section>`;
}

function renderMachine(config: HopConfig, hopPath: string): string {
  const m = config.machine;
  const rootExists = m.agent_root ? existsSync(m.agent_root) : false;
  return `<section>
    <h2 id="machine">Machine</h2>
    <p>Identity of the box this configuration describes. Everything else resolves relative to it.</p>
    ${table(
      ["Field", "Value"],
      [
        ["ID", code(m.id)],
        ["Name", orDash(m.name)],
        ["Type", orDash(m.type)],
        ["OS / Arch", `${orDash(m.os)} / ${orDash(m.arch)}`],
        [
          "Agent root",
          m.agent_root
            ? `${code(m.agent_root)} ${rootExists ? badge("exists", "good") : badge("missing", "bad")}`
            : orDash(null),
        ],
        ["Schema version", orDash(config.schema_version)],
        ["Config file", code(hopPath)],
      ],
      "No machine block."
    )}
  </section>`;
}

function renderAccounts(config: HopConfig): string {
  const accounts: GitHubAccount[] = config.accounts?.github ?? [];
  const rows = accounts.map((a) => [
    code(a.username),
    orDash(a.role),
    a.default ? badge("default", "good") : `<span class="hop-dash">—</span>`,
    orDash(a.auth_method ?? "ssh"),
    a.active === false ? badge("inactive", "warn") : badge("active", "good"),
    orDash(a.note),
  ]);
  return `<section>
    <h2 id="accounts">Accounts</h2>
    <p>Git identities available on this machine. The default is used unless a project overrides it.</p>
    ${table(
      ["Username", "Role", "Default", "Auth", "State", "Note"],
      rows,
      "No accounts configured. Tools that need to pick a git identity will fall back to your global git config."
    )}
  </section>`;
}

function renderProjects(config: HopConfig): string {
  const projects: Project[] = config.projects ?? [];
  const rows = projects.map((p) => {
    const exists = p.path ? existsSync(p.path) : false;
    const status = !p.path
      ? badge("no path", "warn")
      : exists
        ? badge("present", "good")
        : badge("missing", "bad");
    const ext = Object.keys(p.extensions ?? {});
    return [
      `${code(p.name)}`,
      orDash(p.type),
      orDash(p.system),
      status,
      p.path ? `<span class="hop-path">${esc(p.path)}</span>` : orDash(null),
      orDash(p.git?.default_branch),
      ext.length ? ext.map((e) => badge(e, "dim")).join(" ") : orDash(null),
    ];
  });
  return `<section>
    <h2 id="projects">Projects</h2>
    <p>
      Repositories this machine knows by name. <em>Status</em> compares the registered
      path against the filesystem, so a missing row means the entry is stale rather
      than the repo being broken.
    </p>
    ${table(
      ["Name", "Type", "System", "Status", "Path", "Branch", "Extensions"],
      rows,
      "No projects registered. hop path cannot resolve anything until at least one exists."
    )}
  </section>`;
}

function renderBundles(config: HopConfig): string {
  const bundles: Bundle[] = config.bundles ?? [];
  const known = new Set((config.projects ?? []).map((p) => p.name));
  const rows = bundles.map((b) => {
    const members = b.projects.map((name) =>
      known.has(name) ? esc(name) : `${esc(name)} ${badge("unknown", "bad")}`
    );
    return [
      code(b.id),
      orDash(b.name),
      orDash(b.primary_project ?? b.projects[0]),
      members.join(", "),
      orDash(b.description),
    ];
  });
  return `<section>
    <h2 id="bundles">Bundles</h2>
    <p>Named groups of projects worked on together. A member marked <em>unknown</em> is not in the projects list.</p>
    ${table(
      ["ID", "Name", "Primary", "Projects", "Description"],
      rows,
      "No bundles defined. This is optional — it only matters if you want session tooling to default to a subset of projects."
    )}
  </section>`;
}

function renderInfra(config: HopConfig): string {
  const infra = config.infra_repos;
  if (!infra) {
    return `<section>
    <h2 id="infra">Infra repos</h2>
    <p class="hop-empty">No infra_repos block. This is optional — it holds read-only reference clones of upstream projects, kept separate from your own work.</p>
  </section>`;
  }

  const base = infra.path;
  const rows = (infra.repos ?? []).map((entry: string | InfraRepoEntry) => {
    const name = infraRepoName(entry);
    const normalized = normalizeInfraRepo(entry);
    const explicit = typeof entry !== "string" ? entry.path : undefined;
    const repoPath = explicit ?? (base ? join(base, name) : null);
    let status: string;
    if (!repoPath) {
      status = badge("unresolvable", "bad");
    } else if (existsSync(join(repoPath, ".git"))) {
      status = badge("cloned", "good");
    } else if (existsSync(repoPath)) {
      status = badge("no .git", "warn");
    } else {
      status = badge("missing", "bad");
    }
    return [
      code(name),
      orDash(normalized.system),
      status,
      repoPath ? `<span class="hop-path">${esc(repoPath)}</span>` : orDash(null),
      orDash(normalized.description),
    ];
  });

  const meta = table(
    ["Field", "Value"],
    [
      [
        "Path",
        base ? code(base) : `${orDash(null)} ${badge("not set", "bad")}`,
      ],
      ["Read-only", infra.readonly !== false ? badge("yes", "info") : badge("no", "warn")],
      ["Sync", orDash(infra.sync)],
      [
        "Contribute",
        infra.contribute
          ? infra.contribute.allowed
            ? badge("allowed", "warn")
            : badge("not allowed", "info")
          : orDash(null),
      ],
    ],
    "No metadata."
  );

  return `<section>
    <h2 id="infra">Infra repos</h2>
    <p>Read-only reference clones of upstream projects. These are not your work — they exist so tools and agents can read source they do not own.</p>
    ${meta}
    ${table(
      ["Name", "System", "Status", "Path", "Description"],
      rows,
      "No infra repos listed."
    )}
  </section>`;
}

function renderServices(config: HopConfig): string {
  const services = config.services ?? {};
  const rows = Object.entries(services).map(([name, s]) => [
    code(name),
    orDash(s.url),
    orDash(s.binary),
    s.token_env ? code(s.token_env) : orDash(null),
    orDash(s.description),
  ]);
  return `<section>
    <h2 id="services">Services</h2>
    <p>
      Live endpoints agents discover at runtime. Only the name of the variable holding a
      token is recorded — never the token itself.
    </p>
    ${table(
      ["Name", "URL", "Binary", "Token env", "Description"],
      rows,
      "No services defined. Anything expecting a runtime endpoint will need to be pointed at one another way."
    )}
  </section>`;
}

function renderExtensions(config: HopConfig): string {
  const machineExt = config.extensions ?? {};
  const machineRows = Object.entries(machineExt).map(([name, e]) => [
    code(name),
    e.enabled === false ? badge("disabled", "warn") : badge("enabled", "good"),
    esc(
      Object.keys(e)
        .filter((k) => k !== "enabled" && k !== "$schema")
        .join(", ")
    ) || `<span class="hop-dash">—</span>`,
  ]);

  const projectRows: string[][] = [];
  for (const p of config.projects ?? []) {
    for (const [name, e] of Object.entries(p.extensions ?? {})) {
      projectRows.push([
        code(p.name),
        code(name),
        e.enabled === false ? badge("disabled", "warn") : badge("enabled", "good"),
        esc(
          Object.keys(e)
            .filter((k) => k !== "enabled" && k !== "$schema")
            .join(", ")
        ) || `<span class="hop-dash">—</span>`,
      ]);
    }
  }

  return `<section>
    <h2 id="extensions">Extensions</h2>
    <p>
      Tool-specific configuration. The spec does not validate what is inside these —
      each tool owns its own shape — so the columns below list which keys are present
      rather than judging them.
    </p>
    <h3 id="machine-extensions">Machine scope</h3>
    ${table(["Extension", "State", "Keys"], machineRows, "No machine-scoped extensions.")}
    <h3 id="project-extensions">Project scope</h3>
    ${table(
      ["Project", "Extension", "State", "Keys"],
      projectRows,
      "No project-scoped extensions."
    )}
  </section>`;
}

function renderRuntimes(config: HopConfig): string {
  const runtimes = config.runtimes ?? [];

  if (runtimes.length === 0) {
    return `<section>
    <h2 id="runtimes">Runtimes</h2>
    <p class="hop-empty">No runtimes declared. Adding them lets an agent resolve "where is X" in one lookup instead of searching the filesystem.</p>
  </section>`;
  }

  const rows = runtimes.map((r) => {
    // Verified against disk, because a stale entrypoint is worse than none.
    const ok = r.entrypoint ? existsSync(r.entrypoint) : false;
    const state = !r.entrypoint
      ? badge("no entrypoint", "warn")
      : ok
        ? badge("resolves", "good")
        : badge("missing", "bad");
    return [
      code(r.name),
      state,
      r.entrypoint ? `<span class="hop-path">${esc(r.entrypoint)}</span>` : orDash(null),
      r.manager ? badge(r.manager, "dim") : orDash(null),
      r.config ? `<span class="hop-path">${esc(r.config)}</span>` : orDash(null),
      r.upgrade ? code(r.upgrade) : orDash(null),
    ];
  });

  const broken = runtimes.filter((r) => r.entrypoint && !existsSync(r.entrypoint)).length;

  return `<section>
    <h2 id="runtimes">Runtimes</h2>
    <p>
      Programs this machine can run, and who updates each one. <em>Manager</em> is
      the field to check before moving anything: package-managed payloads break
      their own upgrade path if relocated by hand. Entrypoints are verified
      against the filesystem when this page is generated.
    </p>
    ${table(
      ["Name", "State", "Entrypoint", "Manager", "Config", "Upgrade"],
      rows,
      ""
    )}
    ${
      broken > 0
        ? `<div class="callout"><strong>${broken} entrypoint${broken === 1 ? "" : "s"} did not resolve.</strong> The declared path no longer exists — the runtime was moved, upgraded into a new directory, or uninstalled.</div>`
        : ""
    }
  </section>`;
}

function renderHarnesses(config: HopConfig): string {
  const harnesses = config.harnesses ?? [];

  if (harnesses.length === 0) {
    return `<section>
    <h2 id="harnesses">Harnesses</h2>
    <p class="hop-empty">No harnesses declared. Add a <code>harnesses</code> entry pointing at where each agent harness keeps its config, and this section will play back the MCP servers, plugins, and skills currently active.</p>
  </section>`;
  }

  const blocks = harnesses
    .map((h) => {
      const o = observeHarness(h);

      const status = !o.installed
        ? badge("not installed", "bad")
        : o.parsed
          ? badge("observed", "good")
          : badge("declared, unparsed", "warn");

      const pathRows = o.paths.map((p) => [
        esc(p.label),
        `<span class="hop-path">${esc(p.path)}</span>`,
        p.exists ? badge("found", "good") : badge("absent", "warn"),
      ]);

      const mcpRows = o.mcpServers.map((m) => [code(m.name), esc(m.scope)]);

      const skillRows = o.skills.map((s) => [
        `<span class="hop-path">${esc(s.path)}</span>`,
        s.exists ? badge("found", "good") : badge("absent", "dim"),
        s.exists ? String(s.count) : `<span class="hop-dash">—</span>`,
      ]);

      const activation = table(
        ["Surface", "Count", "Detail"],
        [
          [
            "MCP servers (local)",
            String(o.mcpServers.length),
            o.mcpServers.length ? esc(o.mcpServers.map((m) => m.name).join(", ")) : `<span class="hop-dash">—</span>`,
          ],
          [
            "Marketplaces known",
            String(o.marketplaces.length),
            o.marketplaces.length ? esc(o.marketplaces.join(", ")) : `<span class="hop-dash">—</span>`,
          ],
          [
            "Plugins installed",
            String(o.plugins.length),
            o.plugins.length ? esc(o.plugins.join(", ")) : `<span class="hop-dash">—</span>`,
          ],
          [
            "Skills on disk",
            String(o.skills.reduce((n, s) => n + s.count, 0)),
            o.skills.length ? `${o.skills.filter((s) => s.exists).length} of ${o.skills.length} directories present` : `<span class="hop-dash">—</span>`,
          ],
        ],
        ""
      );

      const disclosures = o.disclosures
        .map((d) => `<li class="hop-finding hop-finding-info"><p class="hop-finding-detail">${esc(d)}</p></li>`)
        .join("\n        ");

      return `<h3 id="harness-${esc(slug(o.name))}">${esc(o.name)} ${status}</h3>
    ${activation}
    ${table(["Location", "Path", "State"], pathRows, "No paths declared.")}
    ${o.mcpServers.length ? table(["MCP server", "Scope"], mcpRows, "") : ""}
    ${o.skills.length ? table(["Skills directory", "State", "Skills"], skillRows, "") : ""}
    <p><strong>What this cannot see</strong></p>
    <ul class="hop-findings">
        ${disclosures}
    </ul>`;
    })
    .join("\n\n    ");

  return `<section>
    <h2 id="harnesses">Harnesses</h2>
    <p>
      Agent harnesses installed here, and what each currently has active.
      HarnessOps records only <em>where</em> each keeps its configuration — it does
      not govern MCP servers, plugins, or skills, which move far too quickly for a
      config spec to own. Everything below is read back from the harness's own
      files at the moment this page was generated.
    </p>
    ${blocks}
  </section>`;
}

/**
 * Static reference documentation.
 *
 * Everything above this point describes *your* configuration; this describes
 * the spec itself. It is deliberately static rather than introspected — the
 * surface changes only when the spec changes, and a hand-written explanation
 * reads far better than one reverse-engineered from a schema at runtime. When
 * the spec gains a command, tool, or field, update it here in the same change.
 *
 * Kept last on the page so the reader engages with their own machine first and
 * finds the full capability surface once they have context for it.
 */
function renderReference(): string {
  const cliRows: string[][] = [
    ["hop projects", "List every project. <code>--json</code>, <code>--type</code>, <code>--system</code> filters."],
    ["hop path &lt;name&gt;", "Resolve a project name to its path. Falls back to infra repos, so it answers for both."],
    ["hop machine", "Machine identity and the config file actually in use."],
    ["hop account [user]", "Account details; the default account when no username is given."],
    ["hop where", "Print which hop.json was discovered — the first thing to check when a tool reads the wrong config."],
    ["hop config set-path", "Pin a hop.json location by writing <code>~/.hop/settings.json</code>."],
    ["hop config show", "Show the discovered path and whether it was pinned or found by search."],
    ["hop bundles", "List bundles (named groups of projects)."],
    ["hop bundle &lt;id&gt;", "One bundle, with its member projects resolved to full entries."],
    ["hop infra", "Infra repo clones, each marked cloned / present / missing against the filesystem."],
    ["hop system list", "Every <code>system</code> value in use, with project and infra counts."],
    ["hop system show &lt;name&gt;", "Everything belonging to one system, projects and infra repos together."],
    ["hop validate [file]", "Validate against the JSON Schema. <code>--schema</code> overrides the bundled copy."],
    ["hop discover [dir]", "Scan a directory for git repos and tools; <code>--json</code> emits pasteable project entries."],
    ["hop audit", "Reconcile config against disk — orphans, stale paths, and (with <code>--scan</code>) strays."],
    ["hop report", "This page. <code>--out</code> to redirect, <code>--scan</code> to include the stray scan."],
    ["hop init", "Create a new hop.json. <code>-y</code> accepts defaults."],
  ].map(([cmd, desc]) => [`<code>${cmd}</code>`, desc]);

  const mcpRows: string[][] = [
    ["hop_machine", "Machine identity and configuration."],
    ["hop_list_projects", "All projects — names, paths, types."],
    ["hop_get_project", "Full detail for one project by name."],
    ["hop_get_account", "Account info by service, optionally by username."],
    ["hop_list_bundles", "All bundles."],
    ["hop_get_bundle", "One bundle, with member projects resolved to objects."],
    ["hop_list_infra_repos", "Infrastructure repo clones."],
    ["hop_list_systems", "Every system with its projects and infra repos."],
    ["hop_get_system", "Projects and infra repos for one system."],
  ].map(([n, d]) => [`<code>${n}</code>`, d]);

  const blockRows: string[][] = [
    ["schema_version", badge("required", "bad"), "Which version of the spec this file targets. Parsers need it to know how to read the rest."],
    ["machine", badge("required", "bad"), "Identity of the box. <code>id</code> and <code>name</code> are required; <code>agent_root</code> is optional but most tooling expects it."],
    ["$schema", badge("optional", "dim"), "URI for editor validation. Not consulted at runtime."],
    ["description", badge("optional", "dim"), "Free text for humans."],
    ["accounts", badge("optional", "dim"), "Service identities. <code>github[].username</code> is required within each entry."],
    ["preferences", badge("optional", "dim"), "Timezone and branch-naming patterns."],
    ["cross_project", badge("optional", "dim"), "Names a hub project and a shared artifacts directory for cross-repo output."],
    ["projects", badge("optional", "dim"), "The repos this machine knows. <code>name</code> required; <code>path</code> required in practice."],
    ["bundles", badge("optional", "dim"), "Named project groups. <code>id</code>, <code>name</code>, and a non-empty <code>projects</code> array are required."],
    ["infra_repos", badge("optional", "dim"), "Read-only reference clones. Top-level rather than an extension, because discovery uses it as a scan root."],
    ["scripts", badge("optional", "dim"), "Named path references for advanced workflows."],
    ["extensions", badge("optional", "dim"), "Machine-scoped tool config. The spec does not validate contents."],
    ["services", badge("optional", "dim"), "Live runtime endpoints agents discover. May reference a runtime by name."],
    ["runtimes", badge("optional", "dim"), "Installed programs, with the manager that owns each. Referenced by name so a shared runtime is described once."],
    ["harnesses", badge("optional", "dim"), "Agent harnesses, described by where their config lives. Location only — never content."],
  ].map(([f, req, d]) => [`<code>${f}</code>`, req, d]);

  const apiRows: string[][] = [
    ["discoverHopPath()", "Locate hop.json using the precedence order above; null if none found."],
    ["loadHopConfig(path)", "Parse a hop.json from an explicit path."],
    ["discoverAndLoad()", "Discover and parse in one call — what the CLI and MCP both use."],
    ["setConfigPath(path)", "Pin a location by writing <code>~/.hop/settings.json</code>."],
    ["ensureHopDir()", "Create <code>~/.hop/</code> if absent; returns the path."],
    ["HOP_DIR, HOP_DEFAULT_PATH", "<code>~/.hop</code> and <code>~/.hop/hop.json</code>."],
    ["normalizeInfraRepo(entry)", "Coerce a string-or-object infra entry into object form."],
    ["infraRepoName(entry)", "Get the name from either entry form."],
    ["resolveInfraRepoPath(cfg, name)", "Resolve an infra repo to a directory, honouring per-repo overrides."],
    ["collectSystems(cfg)", "Group projects and infra repos by their <code>system</code> value."],
  ].map(([sig, d]) => [`<code>${sig}</code>`, d]);

  return `<section>
    <h2 id="reference">Reference — using the spec</h2>
    <p>
      Everything above describes this machine. What follows describes HarnessOps
      itself: how a config is found, what can go in it, and the three surfaces
      that read it — a CLI for people, an MCP server for agents, and a library
      for code.
    </p>

    <h3 id="ref-discovery">How a config is found</h3>
    <p>
      Every surface resolves hop.json the same way, first match winning. When a tool
      appears to read the wrong config, <code>hop where</code> settles it immediately.
    </p>
    ${table(
      ["#", "Location", "Purpose"],
      [
        ["1", `<code>~/.hop/settings.json</code> → <code>hop_config</code>`, "Authoritative pointer. Set it with <code>hop config set-path</code>."],
        ["2", `<code>HOP_CONFIG_PATH</code>`, "Environment override, for CI and tests."],
        ["3", `<code>~/.hop/hop.json</code>`, "The default home, created by <code>hop init</code>."],
        ["4", "walk up from cwd", "Project-level override — a hop.json in a repo wins for work inside it."],
        ["5", `<code>~/.config/hop/</code>, <code>/etc/hop/</code>`, "Legacy locations, still honoured."],
      ],
      ""
    )}

    <h3 id="ref-blocks">What goes in a config</h3>
    <p>
      Only two fields are truly required — the rest is progressive enhancement. A
      valid minimal config is <code>schema_version</code> plus a <code>machine</code>
      with an <code>id</code> and a <code>name</code>.
    </p>
    ${table(["Block", "Required", "Purpose"], blockRows, "")}

    <h3 id="ref-git">Branch fields</h3>
    <p>
      <code>git.default_branch</code> is the repository's actual default on the host —
      normally <code>main</code>. <code>git.pr_branch</code> is the branch pull requests
      target when that differs, as in a dev/test/main promotion pipeline. Discovery
      diffs against <code>pr_branch</code>, so "ahead/behind" reflects the real PR diff
      rather than drift against a branch you never merge into directly. Setting
      <code>default_branch</code> to your working branch instead of using
      <code>pr_branch</code> conflates the two and misreports the host default.
    </p>

    <h3 id="ref-scope">What belongs in this file</h3>
    <p>
      One rule keeps the spec from sprawling: <strong>a block earns its place only
      if it answers a "where is X" question in one lookup.</strong> If it describes
      how something behaves, or restates what the filesystem already says, it
      belongs in <code>extensions</code> — or nowhere.
    </p>
    <p>
      That is why <code>runtimes</code> and <code>harnesses</code> record locations
      and ownership but never configuration content. MCP servers, skills, and
      plugins change far too quickly for a config spec to govern; pointing at
      where they are declared is durable, while mirroring what they contain would
      be wrong within a release.
    </p>
    <p>
      The spec also assumes <strong>no administrative rights</strong>. Most
      developers do not have them, and a spec that only works for privileged
      accounts fails the people it exists to serve. <code>entrypoint</code>
      therefore records whatever actually resolves on a given machine — a shim
      script, a package-manager symlink, or a path inside a package directory —
      and <code>manager</code> says who may safely change it.
    </p>

    <h3 id="ref-ext">Extensions and services</h3>
    <p>
      Both are open namespaces, and they answer different questions.
      <strong>Extensions</strong> are configuration for a tool — they exist at machine
      scope (top-level <code>extensions</code>) and project scope
      (<code>projects[*].extensions</code>), and each tool owns its own shape; the spec
      deliberately does not validate inside them. Keys must be lowercase slugs matching
      <code>^[a-z0-9][a-z0-9_-]*[a-z0-9]$</code>.
      <strong>Services</strong> are live endpoints discovered at runtime, carrying
      <code>url</code>, <code>binary</code>, <code>token_env</code>, and
      <code>description</code>. Note <code>token_env</code> holds the <em>name</em> of an
      environment variable — never a credential. Nothing secret belongs in hop.json.
    </p>

    <h3 id="ref-cli">CLI</h3>
    <p>Most commands accept <code>--json</code> for scripting.</p>
    ${table(["Command", "What it does"], cliRows, "")}

    <h3 id="ref-mcp">MCP server</h3>
    <p>
      <code>hop-mcp</code> exposes the same data to agents over stdio — read-only, no
      command mutates the config. All nine tools load by default; set
      <code>HOP_MCP_TOOLS</code> to a comma-separated list to register only some, which
      is worth doing when tool-count budget is tight.
    </p>
    ${table(["Tool", "Returns"], mcpRows, "")}

    <h3 id="ref-api">Library</h3>
    <p><code>@hop-org/hop-spec-core</code> — the resolution and parsing logic, for building your own tooling.</p>
    ${table(["Export", "Purpose"], apiRows, "")}

    <h3 id="ref-workflow">Keeping a config honest</h3>
    <p>
      Three commands cover the maintenance loop.
      <code>hop validate</code> checks the file against the schema — necessary but not
      sufficient, since unknown keys are permitted and a misnamed field will validate
      while doing nothing.
      <code>hop audit</code> compares the config against the filesystem and is what
      catches stale paths and unregistered repos.
      <code>hop report</code> renders both, plus everything the config declares, as this
      page. Run it after any significant change.
    </p>
  </section>`;
}

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------

/**
 * Theme — the only place in this file allowed to name a colour.
 *
 * The foundation defines a token contract and ships neutral defaults; a theme
 * fills the same slots and must be pasted *after* the foundation to win the
 * cascade. Everything downstream (LAYOUT_CSS, every section renderer) refers to
 * tokens only, so swapping this block re-skins the whole report.
 *
 * The look is deliberately terminal-adjacent: this is output from a CLI about a
 * machine, and it should read like tooling rather than a memo. Type is mono
 * throughout via a system stack — Cascadia Code on Windows, SF Mono on macOS,
 * Consolas as the floor — so the file stays self-contained with no embedded
 * webfont and renders the same offline.
 *
 * Light values live in :root and dark values in :root[data-theme="dark"],
 * because the foundation's toggle switches between exactly those two. Defining
 * dark values in a bare :root would make "light" mode render dark.
 */
const THEME_CSS = `
:root{
  --brand-primary:#0E7490; --brand-primary-dark:#155E75;
  --brand-warm:#B45309; --brand-accent2:#0E7490;
  --header-bg:#060A0E; --header-fg:#22D3EE; --header-rule:#22D3EE; --header-tag:#22D3EE;
  --good:#15803D; --warn:#B45309; --bad:#BE123C; --info:#0E7490; --on-status:#F4F7F9;
  --font-display:ui-monospace,'Cascadia Code','JetBrains Mono',Menlo,Consolas,monospace;
  --font-body:ui-monospace,'Cascadia Code','JetBrains Mono',Menlo,Consolas,monospace;
  --font-mono:ui-monospace,'Cascadia Code','JetBrains Mono',Menlo,Consolas,monospace;
  --bg:#F4F7F9; --surface:#FFFFFF; --surface-2:#E8EEF2; --border:#D3DDE4;
  --ink:#0A0E12; --ink-soft:#26323C; --muted:#5A6B7A; --dim:#8A9AA8;
}
:root[data-theme="dark"]{
  --brand-primary:#22D3EE; --brand-primary-dark:#0E7490;
  --bg:#0A0E12; --surface:#111820; --surface-2:#161F29; --border:#1E2A36;
  --ink:#E6EDF3; --ink-soft:#B9C6D3; --muted:#7D8FA1; --dim:#55677A;
  --good:#4ADE80; --warn:#FBBF24; --bad:#F87171; --info:#38BDF8; --on-status:#06121A;
}
`;

/** Layout on top of the foundation. Tokens only — no literal colours. */
const LAYOUT_CSS = `
.hop-layout{display:grid;grid-template-columns:210px minmax(0,1fr);gap:34px;
  max-width:1180px;margin:0 auto;padding:22px var(--doc-pad) 64px}
nav.fdn-toc{position:sticky;top:calc(var(--banner-h) + 14px);align-self:start;
  max-height:82vh;overflow:auto}
nav.fdn-toc h2{margin:0 0 10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);font-weight:700}
nav.fdn-toc a{display:block;padding:3px 9px;margin:1px 0;color:var(--ink-soft);
  text-decoration:none;border-left:2px solid transparent;font-size:13px;border-radius:0 4px 4px 0}
nav.fdn-toc a:hover{background:var(--surface-2)}
nav.fdn-toc a.active{color:var(--brand-primary);border-left-color:var(--brand-primary);font-weight:700}
nav.fdn-toc a.h3{padding-left:20px;color:var(--muted);font-size:12px}

main.hop-main{min-width:0}
.hop-lede{border-bottom:1px solid var(--border);padding-bottom:18px;margin-bottom:26px}
.hop-lede .eyebrow{font-size:11px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--brand-primary);font-weight:700;margin-bottom:6px}
.hop-lede h1{margin:0 0 8px;font-family:var(--font-display);font-size:30px;line-height:1.2}
.hop-lede p{margin:0;color:var(--muted);max-width:70ch}

main.hop-main section{margin:0 0 38px}
main.hop-main h2{font-family:var(--font-display);font-size:21px;margin:0 0 8px;
  padding-bottom:6px;border-bottom:1px solid var(--border)}
main.hop-main h3{font-size:14px;margin:22px 0 8px;color:var(--ink-soft)}
main.hop-main p{margin:0 0 14px;color:var(--ink-soft);max-width:74ch;font-size:14px}

.hop-table-wrap{overflow-x:auto;margin:0 0 14px}
main.hop-main table{border-collapse:collapse;width:100%;font-size:13px}
main.hop-main th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;
  color:var(--muted);font-weight:700;padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
main.hop-main td{padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:top}
main.hop-main tbody tr:hover{background:var(--surface-2)}
main.hop-main code{font-family:var(--font-mono);font-size:12px;background:var(--surface-2);
  padding:1px 5px;border-radius:3px}
.hop-path{font-family:var(--font-mono);font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.hop-dash{color:var(--dim)}
.hop-empty{color:var(--muted);font-style:italic;background:var(--surface-2);
  border-radius:6px;padding:11px 14px;max-width:74ch}

.hop-badge{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.03em;
  padding:1px 7px;border-radius:99px;white-space:nowrap}
.hop-badge-good{background:var(--good);color:var(--on-status)}
.hop-badge-warn{background:var(--warn);color:var(--on-status)}
.hop-badge-bad{background:var(--bad);color:var(--on-status)}
.hop-badge-info{background:var(--info);color:var(--on-status)}
.hop-badge-dim{background:var(--surface-2);color:var(--muted);border:1px solid var(--border)}

.hop-findings{list-style:none;margin:0;padding:0}
.hop-finding{border:1px solid var(--border);border-left:3px solid var(--dim);
  border-radius:6px;padding:12px 15px;margin:0 0 9px;background:var(--surface)}
.hop-finding-error{border-left-color:var(--bad)}
.hop-finding-warn{border-left-color:var(--warn)}
.hop-finding-info{border-left-color:var(--info)}
.hop-finding-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:5px}
.hop-finding-area{font-family:var(--font-mono);font-size:11px;color:var(--muted)}
.hop-finding-title{font-weight:700;font-size:14px}
.hop-finding-detail{margin:0;color:var(--ink-soft);font-size:13.5px;max-width:78ch}
.hop-finding-remedy{margin:6px 0 0;font-size:13px;color:var(--muted);max-width:78ch}

.callout{border-left:3px solid var(--brand-primary);background:var(--surface-2);
  padding:12px 15px;border-radius:0 6px 6px 0;font-size:14px}
.callout.good{border-left-color:var(--good)}

main.hop-main footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);
  color:var(--muted);font-size:12px}

@media (max-width:900px){
  .hop-layout{grid-template-columns:1fr;padding:16px var(--doc-pad) 48px}
  nav.fdn-toc{display:none}
}
@media print{
  nav.fdn-toc{display:none}
  .hop-layout{display:block;padding:0}
  .hop-finding{break-inside:avoid}
  main.hop-main table{font-size:10.5px}
}
`;

/** Small TOC + scrollspy script. Kept separate from the vendored foundation. */
const TOC_JS = `
(function(){
  var main=document.querySelector('main.hop-main'),toc=document.getElementById('fdnToc');
  if(!main||!toc)return;
  var heads=main.querySelectorAll('h2, h3');
  if(!heads.length){toc.remove();return;}
  heads.forEach(function(h){
    var a=document.createElement('a');
    a.href='#'+h.id;a.textContent=h.textContent;a.dataset.t=h.id;
    if(h.tagName==='H3')a.className='h3';
    a.addEventListener('click',function(e){
      e.preventDefault();
      var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){}
      h.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      try{history.replaceState(null,'','#'+h.id);}catch(_){}
    });
    toc.appendChild(a);
  });
  if('IntersectionObserver' in window){
    var obs=new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting){
          var id=en.target.id;
          toc.querySelectorAll('a').forEach(function(l){l.classList.toggle('active',l.dataset.t===id);});
        }
      });
    },{rootMargin:'-12% 0px -75% 0px'});
    heads.forEach(function(h){obs.observe(h);});
  }
})();
`;

function buildHtml(config: HopConfig, hopPath: string, findings: Finding[], generated: string): string {
  const machineName = config.machine?.name ?? config.machine?.id ?? "this machine";
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;

  const orientation =
    errors + warns === 0
      ? `Everything registered here matches what is on disk. Read on for what this machine is configured to do.`
      : `${errors + warns} ${errors + warns === 1 ? "item needs" : "items need"} your attention — start with Health, then read the sections for context.`;

  const sections = [
    renderHealth(findings),
    renderMachine(config, hopPath),
    renderAccounts(config),
    renderProjects(config),
    renderBundles(config),
    renderInfra(config),
    renderServices(config),
    renderRuntimes(config),
    renderHarnesses(config),
    renderExtensions(config),
    renderReference(),
  ].join("\n\n  ");

  return `<!DOCTYPE html>
<!--
  Generated by \`hop report\` — a read-only view of a hop.json.
  Self-contained: no network requests, safe to open offline.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HarnessOps configuration — ${esc(machineName)}</title>
<style>
${FOUNDATION_CSS}
${THEME_CSS}
${LAYOUT_CSS}
</style>
</head>
<body>

<header class="fdn-banner">
  <span class="brand-logo" role="img" aria-label="HarnessOps"></span>
  <span class="bt"><span class="tag">HarnessOps</span><br>${esc(generated)}</span>
</header>

<div class="fdn-spwarn" id="fdnSpWarn"><b>Heads up — you're viewing this in SharePoint's preview.</b>
  The dark/light toggle and contents links work here, but Save-as-PDF and precise section jumps need the full file. Download it and open it in your browser.</div>

<div class="hop-doc" data-doc-type="report">
  <div class="hop-layout">
    <nav class="fdn-toc" id="fdnToc"><h2>On this page</h2></nav>
    <main class="hop-main">

      <div class="hop-lede">
        <div class="eyebrow">Machine configuration</div>
        <h1>${esc(machineName)}</h1>
        <p>${esc(orientation)}</p>
      </div>

  ${sections}

      <footer>
        Generated from <code>${esc(hopPath)}</code> on ${esc(generated)} ·
        schema ${esc(config.schema_version ?? "unknown")} ·
        read-only view, nothing here was modified
      </footer>
    </main>
  </div>
</div>

<button id="fdnTheme" class="fdn-btn" title="Toggle light / dark" aria-label="Toggle light or dark"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style="display:block"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5Z" fill="currentColor"/></svg></button>
<button id="fdnPdf" class="fdn-btn" title="Save as PDF" aria-label="Save as PDF"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style="display:block"><path d="M4 6V2.5h8V6M4 11.5H2.5V6h11v5.5H12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><rect x="4.75" y="9.75" width="6.5" height="4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>

<script>(function(){try{var s=localStorage.getItem("hop-doc-theme");
  document.documentElement.setAttribute("data-theme",s||"dark");}catch(e){
  document.documentElement.setAttribute("data-theme","dark");}})();</script>
<script>
${FOUNDATION_JS}
</script>
<script>
${TOC_JS}
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function runReport(
  config: HopConfig,
  hopPath: string,
  opts: ReportOptions
): Promise<void> {
  const findings = analyze(config, opts.scan ?? false);
  const generated = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const html = buildHtml(config, hopPath, findings, generated);

  const outPath = opts.out ? resolve(opts.out) : defaultOutPath();
  try {
    // Only the default location is ours to create; an explicit --out is the
    // caller's business and should fail loudly if the directory is missing.
    if (!opts.out) ensureHopDir();
    writeFileSync(outPath, html, "utf-8");
  } catch (err) {
    console.error(`Error: Could not write ${outPath}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return;
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  console.log(`Wrote ${outPath}`);
  console.log(`  ${errors} broken, ${warns} needing attention, ${infos} worth knowing`);

  // Non-zero only for genuine contradictions, so the command stays usable in
  // scripts without every optional gap turning into a failure.
  if (errors > 0) process.exitCode = 1;
}
