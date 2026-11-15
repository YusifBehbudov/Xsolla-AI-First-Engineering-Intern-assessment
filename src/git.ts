import { execFileSync } from "node:child_process";
import type { ChangedFile } from "./types.js";

export class GitError extends Error {}

function git(repositoryPath: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: repositoryPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.toString().trim();
    throw new GitError(`git ${args[0]} failed in ${repositoryPath}: ${stderr || (error as Error).message}`);
  }
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";
  // A ref such as "--output=/some/file" would be read by git as an option.
  if (base.trim() === "" || base.startsWith("-")) {
    throw new GitError(`Invalid base ref: "${base}"`);
  }
  const output = git(repositoryPath, ["diff", "--name-status", `${base}...HEAD`, "--"]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...pathParts] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}
