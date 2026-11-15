import { describe, expect, it } from "vitest";
import { markdownReport } from "../src/report.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [{ command: "npm test", status: "passed", output: "ok" }],
    });

    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });

  it("shows whether each validation passed or failed", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [{ command: "npm test", status: "failed", output: "1 failing", exitCode: 1 }],
    });
    expect(report).toContain("Status: FAILED, exit code 1");
  });

  it("says so when there is nothing to report", () => {
    const report = markdownReport({ repositoryPath: "/work/sample", changedFiles: [], validationResults: [] });
    expect(report).toContain("No changed files.");
    expect(report).toContain("No validation commands were run.");
  });

  it("does not let command output close the code block", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [{ command: "x", status: "passed", output: "```\n# Injected heading" }],
    });
    expect(report).toContain("````\n```\n# Injected heading\n````");
  });
});
