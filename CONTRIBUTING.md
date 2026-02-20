# Contributing to HarnessOps

Thank you for your interest in contributing to the HarnessOps specification. This document outlines how to propose changes, report issues, and participate in the community.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Ways to Contribute](#ways-to-contribute)
3. [Reporting Issues](#reporting-issues)
4. [Proposing Changes](#proposing-changes)
5. [RFC Process](#rfc-process)
6. [Development Setup](#development-setup)
7. [Pull Request Guidelines](#pull-request-guidelines)
8. [Style Guide](#style-guide)
9. [Community](#community)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

**In summary:**
- Be respectful and inclusive
- Focus on what is best for the community
- Show empathy towards other community members
- Gracefully accept constructive criticism

Report unacceptable behavior to the project maintainers.

---

## Ways to Contribute

### For Everyone

- **Report bugs** in the specification or documentation
- **Suggest improvements** to clarity or completeness
- **Share use cases** - how are you using HarnessOps?
- **Write tutorials** or blog posts about HarnessOps
- **Help answer questions** in discussions

### For Developers

- **Implement HarnessOps tooling** - validators, editors, converters
- **Review pull requests** for technical accuracy
- **Write tests** for schema validation
- **Build integrations** with existing tools

### For Specification Work

- **Propose schema changes** via RFC process
- **Review RFCs** and provide feedback
- **Document patterns** discovered in real-world use
- **Analyze competing approaches** and patterns

---

## Reporting Issues

### Before Opening an Issue

1. **Search existing issues** to avoid duplicates
2. **Check the FAQ** (if available) for common questions
3. **Verify against latest spec** - is the issue still present?

### Issue Templates

When reporting issues, please use the appropriate template:

**Bug Report:**
```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- HarnessOps Schema Version:
- Tool/Validator Used:
- OS:
```

**Feature Request:**
```markdown
## Problem Statement
What problem does this solve?

## Proposed Solution
Describe your proposed approach

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Examples, use cases, related standards
```

---

## Proposing Changes

### Minor Changes

For small fixes (typos, clarifications, formatting):

1. Fork the repository
2. Create a branch: `fix/description`
3. Make your changes
4. Submit a pull request

### Significant Changes

For changes that affect the schema structure, validation rules, or semantics:

1. **Open a discussion** first to gauge interest
2. **Write an RFC** if the change is substantial
3. **Wait for feedback** from maintainers
4. **Implement** once RFC is accepted

---

## RFC Process

RFCs (Request for Comments) are the process for proposing significant changes to the HarnessOps specification.

### When is an RFC Required?

- Adding new top-level fields
- Changing required/optional status of fields
- Modifying validation rules
- Adding new machine types or patterns
- Breaking changes to existing features

### RFC Template

Create a file in `rfcs/NNNN-title.md`:

```markdown
# RFC NNNN: Title

## Summary
One paragraph explanation of the change.

## Motivation
Why are we doing this? What use cases does it support?

## Detailed Design
Technical details of how the change would work.

## Drawbacks
Why should we *not* do this?

## Alternatives
What other designs have been considered?

## Prior Art
How do other specifications handle this?

## Unresolved Questions
What parts of the design are still TBD?
```

### RFC Lifecycle

1. **Draft** - Initial proposal, open for feedback
2. **Discussion** - Community review period (minimum 2 weeks)
3. **Final Comment Period** - Last call for objections (1 week)
4. **Accepted** - Ready for implementation
5. **Implemented** - Merged into spec
6. **Rejected** - Not accepted (with explanation)

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) 1.0+ (runtime and test runner)
- Git

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/hop-org/hop-spec.git
cd hop-spec

# Install dependencies
bun install

# Build all packages
cd packages/hop-core && bun run build
cd ../hop-cli && bun run build
cd ../hop-mcp && bun run build
cd ../..

# Validate examples using the CLI
hop validate spec/examples/hop-example-minimal.json
hop validate spec/examples/hop-example-local-dev.json
hop validate spec/examples/hop-example-cloud-ide.json
hop validate spec/examples/hop-example-vps-server.json
```

### Running Tests

```bash
# CLI tests (19 tests)
cd packages/hop-cli && bun test

# MCP server tests (9 tests)
cd packages/hop-mcp && bun test
```

### Publishing to npm

Packages use `workspace:*` dependencies, which bun resolves to real version numbers during publish:

```bash
# Publish all packages (bun handles workspace:* → version resolution)
cd packages/hop-core && bun publish --access public
cd packages/hop-cli && bun publish --access public
cd packages/hop-mcp && bun publish --access public
```

Packages are published under the `@hop-org` npm scope. The scope must exist at [npmjs.com](https://www.npmjs.com/org/create) before the first publish.

---

## Pull Request Guidelines

### Before Submitting

1. **Test your changes** - Validate examples still pass
2. **Update documentation** - Keep docs in sync with changes
3. **Follow style guide** - Consistent formatting
4. **Write clear commit messages** - Explain what and why

### PR Title Format

```
type: brief description

Examples:
- fix: correct typo in machine.type enum
- feat: add container machine type
- docs: improve getting-started guide
- rfc: add proposal for lockfile concept
```

### PR Description Template

```markdown
## Summary
What does this PR do?

## Related Issues
Fixes #123, Related to #456

## Checklist
- [ ] Schema validates (`ajv compile`)
- [ ] Examples pass validation
- [ ] Documentation updated
- [ ] No breaking changes (or RFC approved)
```

### Review Process

1. **Automated checks** must pass
2. **At least one maintainer approval** required
3. **Discussion resolved** - All comments addressed
4. **Squash and merge** - Clean commit history

---

## Style Guide

### System Field Conventions

When adding a `system` field to projects or infra repos:
- Use **lowercase slugs** only (`payments`, `agent-flywheel`, not `Payments` or `agent_flywheel`)
- Must match pattern: `^[a-z0-9][a-z0-9-]*[a-z0-9]$` (or single char `^[a-z0-9]$`)
- Choose system names that describe the **product/capability**, not the team or tech stack
- Good: `payments`, `analytics`, `agent-flywheel`
- Bad: `team-alpha`, `node-services`, `v2`

### JSON Schema Style

```json
{
  "propertyName": {
    "type": "string",
    "description": "Clear, concise description starting with capital letter",
    "examples": ["example-one", "example-two"]
  }
}
```

### Documentation Style

- Use **American English** spelling
- Write in **present tense** ("HarnessOps provides..." not "HarnessOps will provide...")
- Use **active voice** when possible
- Keep sentences **concise and direct**
- Use **code blocks** for JSON examples
- Include **links** to related sections

### Commit Message Style

```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(schema): add devcontainer machine type

Support for VS Code devcontainer environments. Adds new machine.type
enum value 'devcontainer' with appropriate documentation.

Closes #42
```

---

## Community

### Getting Help

- **GitHub Discussions** - Ask questions, share ideas
- **Issues** - Report bugs, request features
- **Pull Requests** - Contribute changes

### Communication Channels

- GitHub repository: Primary communication hub
- (Future) Discord/Slack: Community chat
- (Future) Mailing list: Announcements

### Maintainers

Current maintainers are listed in the repository's MAINTAINERS file (when created).

### Recognition

Contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes for significant contributions
- GitHub contributors graph

---

## Questions?

If something isn't clear in this guide, please:
1. Check existing issues/discussions
2. Open a new discussion asking for clarification
3. Suggest improvements to this document

Thank you for contributing to HarnessOps!

---

*Last updated: 2026-01-27*
