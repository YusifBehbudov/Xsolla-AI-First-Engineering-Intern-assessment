import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runValidation, runValidations } from "../src/validation.js";

const cwd = tmpdir();

describe("runValidation", () => {
  it("reports a passing command", async () => {
    const result = await runValidation(`node -e "console.log('all good')"`, cwd);
    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("all good");
  });

  it("reports a failing command instead of throwing, keeping stdout and stderr", async () => {
    const result = await runValidation(
      `node -e "console.log('some output'); console.error('boom'); process.exit(3)"`,
      cwd,
    );
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
    expect(result.output).toContain("some output");
    expect(result.output).toContain("boom");
  });

  it("stops a command (and its child processes) that runs past the timeout", async () => {
    const started = Date.now();
    // "&& echo done" keeps the shell alive as a parent, so this also checks that children are killed.
    const result = await runValidation(`node -e "setTimeout(() => {}, 20000)" && echo done`, cwd, {
      timeoutMs: 500,
    });
    expect(result.status).toBe("failed");
    expect(result.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it("keeps running later commands after one fails", async () => {
    const results = await runValidations([`node -e "process.exit(1)"`, `node -e "process.exit(0)"`], cwd);
    expect(results.map((result) => result.status)).toEqual(["failed", "passed"]);
  });
});
