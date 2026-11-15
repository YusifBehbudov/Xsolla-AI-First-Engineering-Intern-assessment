# Repository Inspector

A small TypeScript developer tool that inspects changes in a Git repository,
runs optional validation commands, and produces a Markdown report. It can be
used from the command line or exposed to AI clients through MCP.

> Started from the Xsolla AI-First Engineering Intern assessment template.
> My decisions, scope and verification notes are in `SUBMISSION.md`.

## Interface decision: hybrid, with a narrower MCP surface

Both interfaces call the same `reviewRepository` function in `src/core.ts`,
so the same input produces the same report and the same errors. They differ
only in **who is trusted**:

| | CLI | MCP server |
|---|---|---|
| Caller | A developer at a terminal, or CI | An AI agent, which can be steered by text it reads |
| Repository path | Any path | Must be inside an allowed root (default: the folder the server was started in) |
| Validation commands | Any command (`--validate`) | Only exact commands pre-approved with `--allow-validate` (none by default) |
| Errors | Message on stderr, exit code 1 | Tool result with `isError: true` |

Validation commands never crash the review: a failing command is reported as
`FAILED` with its exit code. Each command has a five-minute timeout, after
which it and its child processes are stopped. Output is capped at 20,000
characters per command (the end is kept).

## Setup

```bash
npm install
npm run typecheck
npm test
```

## CLI

```bash
npm run inspector -- review --repo ./path/to/repo
npm run inspector -- review --repo "./path with spaces" --base-ref develop --validate "npm test"
```

The report is written to `review-report.md`. Unknown options and options
without a value are rejected. Only the `markdown` format is implemented;
`--format json` is rejected with a clear error instead of being ignored.

## MCP

```bash
# Changed files only; repositories under the current folder
npm run mcp-server

# Allow repositories under ~/code and let the agent run exactly "npm test"
npm run mcp-server -- --allowed-root ~/code --allow-validate "npm test"
```

Tool `review_repository`:

| Field | Type | Notes |
|---|---|---|
| `repo_path` | string, required | Must resolve (after symlinks) inside an allowed root. |
| `baseRef` | string, optional | Default `main`. Values starting with `-` are rejected. |
| `validationCommands` | string[], optional | Each must exactly match an `--allow-validate` value. |

The field names keep the original contract's casing so existing clients keep working.

## Project layout

```text
src/core.ts         shared review orchestration (used by both interfaces)
src/cli.ts          command-line adapter
src/mcp-server.ts   MCP adapter
src/policy.ts       what MCP clients are allowed to do
src/git.ts          Git inspection
src/validation.ts   validation execution
src/report.ts       Markdown report generation
test/               tests (vitest)
```
