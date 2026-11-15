import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";

describe("changedFiles", () => {
  it("rejects a base ref that git would read as an option", () => {
    expect(() => changedFiles(tmpdir(), "--output=/tmp/pwned")).toThrow(/Invalid base ref/);
  });

  it("gives a clear error for a folder that is not a git repository", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "not-a-repo-"));
    expect(() => changedFiles(dir)).toThrow(/git diff failed/);
  });
});
