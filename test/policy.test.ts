import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeRequest, parsePolicyArgs } from "../src/policy.js";

function setup() {
  const root = mkdtempSync(path.join(tmpdir(), "policy-root-"));
  const repo = path.join(root, "project");
  mkdirSync(repo);
  const outside = mkdtempSync(path.join(tmpdir(), "policy-outside-"));
  return { root, repo, outside };
}

describe("MCP policy", () => {
  it("allows a repository inside an allowed root", () => {
    const { root, repo } = setup();
    const policy = parsePolicyArgs(["--allowed-root", root]);
    expect(() => authorizeRequest(policy, repo)).not.toThrow();
  });

  it("rejects a repository outside the allowed roots, including via ..", () => {
    const { root, repo, outside } = setup();
    const policy = parsePolicyArgs(["--allowed-root", root]);
    expect(() => authorizeRequest(policy, outside)).toThrow(/outside the allowed roots/);
    expect(() => authorizeRequest(policy, path.join(repo, "..", ".."))).toThrow(/outside the allowed roots/);
  });

  it("rejects every validation command when none were approved", () => {
    const { root, repo } = setup();
    const policy = parsePolicyArgs(["--allowed-root", root]);
    expect(() => authorizeRequest(policy, repo, ["npm test"])).toThrow(/not allowed/);
  });

  it("only accepts exactly the approved commands", () => {
    const { root, repo } = setup();
    const policy = parsePolicyArgs(["--allowed-root", root, "--allow-validate", "npm test"]);
    expect(authorizeRequest(policy, repo, ["npm test"]).validationCommands).toEqual(["npm test"]);
    expect(() => authorizeRequest(policy, repo, ["npm test; rm -rf ~"])).toThrow(/not allowed/);
  });
});
