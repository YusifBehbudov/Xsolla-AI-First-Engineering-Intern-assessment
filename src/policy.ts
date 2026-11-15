import { realpathSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

/**
 * What an MCP client (an AI agent) is allowed to do. The human who starts
 * the server sets this; the agent cannot change it.
 */
export type McpPolicy = {
  allowedRoots: string[];
  allowedValidations: string[];
};

export class PolicyError extends Error {}

function realDirectory(target: string): string {
  try {
    return realpathSync(path.resolve(target));
  } catch {
    throw new PolicyError(`Path does not exist: ${target}`);
  }
}

/** Reads `--allowed-root <dir>` and `--allow-validate <command>` (both repeatable). */
export function parsePolicyArgs(argv: string[], cwd: string = process.cwd()): McpPolicy {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      "allowed-root": { type: "string", multiple: true },
      "allow-validate": { type: "string", multiple: true },
    },
  });
  const roots = values["allowed-root"]?.length ? values["allowed-root"] : [cwd];
  return {
    allowedRoots: roots.map(realDirectory),
    allowedValidations: (values["allow-validate"] ?? []).map((command) => command.trim()),
  };
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

/** Checks an MCP request against the policy. Returns the resolved real path. */
export function authorizeRequest(
  policy: McpPolicy,
  repositoryPath: string,
  validationCommands: string[] = [],
): { repositoryPath: string; validationCommands: string[] } {
  const realPath = realDirectory(repositoryPath);
  if (!policy.allowedRoots.some((root) => isInside(root, realPath))) {
    throw new PolicyError(
      `Repository path is outside the allowed roots (${policy.allowedRoots.join(", ")}): ${repositoryPath}`,
    );
  }
  const commands = validationCommands.map((command) => command.trim());
  const rejected = commands.filter((command) => !policy.allowedValidations.includes(command));
  if (rejected.length > 0) {
    const allowed = policy.allowedValidations.length
      ? policy.allowedValidations.map((command) => `"${command}"`).join(", ")
      : "none (start the server with --allow-validate to enable)";
    throw new PolicyError(`Validation command not allowed: "${rejected[0]}". Allowed: ${allowed}`);
  }
  return { repositoryPath: realPath, validationCommands: commands };
}
