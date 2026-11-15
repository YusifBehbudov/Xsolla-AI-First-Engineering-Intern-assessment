# Submission

## What did you investigate first, and why?

The project is small, so I read every file and traced one request from each
adapter (`cli.ts`, `mcp-server.ts`) into `core.ts`. The brief asks about
safety and interface consistency, so I looked first at what each interface
lets a caller control: the repository path, the base ref and the validation
commands. I reproduced each suspected bug against a scratch Git repository
before changing code:

- **MCP silently inspected the wrong folder.** The schema declares `repo_path`, but the
  handler read `input.repoPath` (typed `any`), so the path was always `undefined` and
  git ran in the MCP server's own working directory.
- **MCP could run any shell command.** `validationCommands` went straight to `exec()`,
  so an AI client, or a prompt injection in content it read, could run anything on the host.
- **Base ref option injection.** `baseRef` was placed first in git's arguments, so
  `--output=/tmp/pwned` made git create the file `/tmp/pwned...HEAD`. I reproduced this.
- **A failing validation crashed the whole review** (`--validate "exit 1"` → `Fatal error`),
  although a failing test is exactly what a review should report. There was also no
  timeout, and stderr was dropped whenever stdout had text.
- **`--repo "/tmp/my repo"` became `/tmp/my`** because of `.split(" ")[0]`.
- **Unknown CLI options and `--format json` were silently ignored.**

## What did you choose to implement or fix?

Ordered by impact; one commit each, with tests:

1. **Validation** (`src/validation.ts`): never rejects. A failing, crashing or timed-out
   command becomes `status: "failed"` with `exitCode`/`timedOut`. stdout and stderr are both
   kept. A five-minute timeout stops the command *and its child processes* (process group
   on POSIX, `taskkill /T` on Windows). Output is capped at 20,000 chars, keeping the end.
2. **Report** (`src/report.ts`): shows PASSED/FAILED and the exit code, uses a code fence
   longer than any backtick run in the output (so output cannot break the Markdown), and
   shows empty states.
3. **Core and git**: `reviewRepository` rejects a missing or non-existent path instead of
   falling back to the current folder, and rejects formats it does not implement. Base refs
   starting with `-` are rejected, `--` ends git's option parsing, and git errors become
   readable messages.
4. **MCP**: reads `repo_path` correctly. The handler re-parses with the same zod schema the
   client sees, so a field mismatch fails loudly. Errors are returned as `isError: true`.
   It uses the non-deprecated `registerTool`. An operator policy (`src/policy.ts`) is set by
   whoever starts the server: `--allowed-root` (default: the start folder, resolved through
   symlinks) and `--allow-validate` (exact matches only, none by default).
5. **CLI**: paths with spaces work; unknown options and missing values are errors; errors
   print a message instead of a stack trace.
6. **Docs and packaging**: README documents the interface decision and the MCP contract;
   `bin` now points to `dist/src/cli.js`, which is where `tsc` emits it.

## What did you intentionally not do?

- **JSON output.** The CLI now rejects `--format json` clearly instead of pretending to
  support it. Implementing it properly is the next step.
- **Rename and Unicode parsing in `git diff`.** Renames show as one tab-joined path, and
  non-ASCII names are quoted. The fix is `git diff -z`; I judged it lower impact than the
  safety issues.
- **Default branch detection.** The default base is still `main`, but a missing ref now
  gives a readable error.
- **Renaming MCP fields** to one casing (`repo_path` vs `baseRef`): cleaner, but it would
  break existing clients.
- **Uncommitted changes, and sandboxing validation commands** (containers): out of scope.

## Interface decision

- Decision: **hybrid**. One shared core with two thin adapters, and a narrower MCP surface.
- Primary user and execution environment: a developer on their own machine or in CI
  (CLI), and an AI coding agent on the same machine over stdio (MCP).
- Trust boundary and allowed capabilities: the human at the CLI is trusted and may run any
  `--validate` command against any path. The MCP client is not fully trusted, because its
  inputs can be steered by content it reads. It can inspect only repositories inside
  operator-approved roots and run only commands that exactly match an operator-approved list.
  By default it can run none, which makes the server read-only.
- Reliability, discoverability, latency/context, and output tradeoffs: MCP gives agents a
  typed, self-describing tool, and the schema description lists the allowed commands. But
  every result costs context, so output is capped per command. The CLI is easier to script
  and debug and works in CI. Validation can be slow, so both interfaces share the same timeout.
- How supported interfaces remain consistent: both call `reviewRepository` in `core.ts`, which
  validates the path and format. The adapters only parse input, and MCP additionally applies
  the policy. The tests target the core, so both interfaces get the same behaviour.
- Evidence that would change this decision: if most usage comes from agents that already have
  a shell tool, CLI-first with JSON output would be simpler and the MCP server could go. If
  agents often need commands outside the allowlist, I would add named validation presets in
  a config file. If the server were exposed remotely over HTTP, it would need authentication
  and a far stricter policy.

## How did you use an AI coding agent?

I used Claude (claude.ai) to read the repository, list suspected bugs, and reproduce them
against scratch repositories. It then wrote the fixes and tests and checked each step with
typecheck and tests. I applied the changes as one commit per step, read the diffs, and ran
the verification commands below on my own machine.

## Where did you check, correct, or reject an AI suggestion? (required)

- **Scope.** The AI's first patch set also rewrote the CLI parser, added JSON output, and
  reworked git diff parsing. I rejected that as too much to review and verify properly in
  90 minutes, and asked for only the high-impact fixes. The rest is listed under
  "intentionally not done".
- **MCP field names.** The first review suggested making the MCP field casing consistent.
  I kept `repo_path`/`baseRef`/`validationCommands` as they are, because renaming would
  break clients of the advertised contract.
- **Deprecated API.** The first MCP fix used `server.tool(...)`. Checking the
  `@modelcontextprotocol/sdk` v1.29.0 source showed it is `@deprecated` in favour of
  `registerTool`, so it was changed.
- **Timeout implementation.** The first version used `exec` with its `timeout` option. That
  kills only the shell, not the commands it started. On Windows the child keeps the output
  pipe open, so the review would still hang. It was replaced with `spawn` plus killing the
  whole process tree, and the test uses `... && echo done` so the shell stays a parent.

## Commands used to verify the result, with outcomes

- `npm install` — dependencies installed
- `npm run typecheck` — no errors
- `npm test` — 17 tests passed across 5 files
- `npm run build` — `dist/src/cli.js` produced, matching `bin`
- `npx tsx src/cli.ts review --repo . --validate "exit 1" --validate "echo ok"` — report
  written, showing `Status: FAILED, exit code 1` and `Status: PASSED, exit code 0` (before
  the fix: `Fatal error`)
- `npx tsx src/cli.ts review --repo . --valdiate x` — `Error: Unknown option: --valdiate`
  (before: silently ignored)
- `npx tsx src/cli.ts review --repo . --format json` — clear "only markdown" error
  (before: silently wrote Markdown)
- `npx tsx src/mcp-server.ts` — starts and prints the allowed roots and validations
- GitHub Actions "Public checks" — green

## A blocker you hit and how you approached it

The original MCP handler was typed `input: any`, which is why the `repo_path`/`repoPath`
mismatch compiled at all. Rather than relying on the SDK's inferred argument types, the
handler accepts `unknown` and parses it with the same zod schema it advertises, so the
types and the runtime check cannot drift apart.

## Known limitations and the next three things you would do

Limitations: no JSON output; renamed and non-ASCII file names are not parsed cleanly; the
default base is always `main`; the MCP server has no automated end-to-end test; the
Windows process-tree kill relies on `taskkill`.

Next three:
1. Add an MCP end-to-end test with the SDK's in-memory transport: `repo_path` honoured,
   a disallowed command rejected, a path outside the allowed roots rejected.
2. Switch to `git diff -z` and handle renames/copies, then detect the default branch
   (`main`, then `master`).
3. Add JSON output in `core.ts` (shared by both interfaces) and return it to MCP clients
   as `structuredContent` with an `outputSchema`.

## Approximate focused-work time

- Start: 01:04
- Finish: 02:50
- Note: about 40 minutes of this was environment setup (installing tools,
  creating the repo from the template) and a break; focused work on the
  task itself was about 65 minutes.
