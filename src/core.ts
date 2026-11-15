import { statSync } from "node:fs";
import { changedFiles } from "./git.js";
import { markdownReport } from "./report.js";
import type { ReviewRequest } from "./types.js";
import { runValidations } from "./validation.js";

/** Shared by the CLI and the MCP server, so both validate input the same way. */
export async function reviewRepository(request: ReviewRequest): Promise<string> {
  const { repositoryPath } = request;
  if (typeof repositoryPath !== "string" || repositoryPath.trim() === "") {
    // Without this check git would silently run in the current working directory.
    throw new Error("repositoryPath is required.");
  }
  let isDirectory = false;
  try {
    isDirectory = statSync(repositoryPath).isDirectory();
  } catch {
    isDirectory = false;
  }
  if (!isDirectory) {
    throw new Error(`Repository path does not exist or is not a directory: ${repositoryPath}`);
  }
  if (request.format !== undefined && request.format !== "markdown") {
    throw new Error(`Unsupported format "${request.format}": only "markdown" is implemented.`);
  }

  const files = changedFiles(repositoryPath, request.baseRef);
  const validations = await runValidations(request.validationCommands ?? [], repositoryPath);
  return markdownReport({
    repositoryPath,
    changedFiles: files,
    validationResults: validations,
  });
}
