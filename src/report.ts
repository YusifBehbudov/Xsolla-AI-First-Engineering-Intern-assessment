import type { ChangedFile, ValidationResult } from "./types.js";

type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

/** A code fence longer than any run of backticks in the text, so command output cannot close it early. */
function fenceFor(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longestRun + 1));
}

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  if (input.changedFiles.length === 0) {
    lines.push("", "No changed files.");
  }
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }

  lines.push("", "## Validation output");
  if (input.validationResults.length === 0) {
    lines.push("", "No validation commands were run.");
  }
  for (const result of input.validationResults) {
    const exit = result.exitCode === undefined ? "" : `, exit code ${result.exitCode ?? "none"}`;
    const output = result.output || "(no output)";
    const fence = fenceFor(output);
    lines.push(
      "",
      `### ${result.command}`,
      "",
      `Status: ${result.status.toUpperCase()}${exit}${result.timedOut ? ", timed out" : ""}`,
      "",
      fence,
      output,
      fence,
    );
  }
  return lines.join("\n") + "\n";
}
