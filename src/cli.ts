#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { reviewRepository } from "./core.js";

const USAGE = "Usage: inspector review --repo <path> [--base-ref <ref>] [--validate <command>]...";

type Args = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format?: "markdown" | "json";
  validations: string[];
};

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? "", validations: [] };
  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];
    const value = (): string => {
      const next = argv[++index];
      if (next === undefined || next.startsWith("--")) {
        throw new UsageError(`${token} needs a value.`);
      }
      return next;
    };
    if (token === "--repo") {
      // Keep the whole value: paths may contain spaces.
      args.repositoryPath = value();
    } else if (token === "--base-ref") {
      args.baseRef = value();
    } else if (token === "--format") {
      const format = value();
      if (format !== "markdown" && format !== "json") {
        throw new UsageError(`--format must be "markdown" or "json", got "${format}".`);
      }
      args.format = format;
    } else if (token === "--validate") {
      args.validations.push(value());
    } else {
      throw new UsageError(`Unknown option: ${token}`);
    }
  }
  return args;
}

async function main() {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n${USAGE}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  if (args.command !== "review" || !args.repositoryPath) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const report = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
    format: args.format,
  });
  writeFileSync("review-report.md", report, "utf8");
  console.log("Review report written to review-report.md");
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
